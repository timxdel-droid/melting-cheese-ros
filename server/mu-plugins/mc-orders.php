<?php
/**
 * Plugin Name: Melting Cheese — App Orders
 * Description: Lets the customer apps submit an order and lets the ROS console read and advance it. Orders are stored as real WooCommerce orders.
 * Version:     1.0.0
 * Author:      Melting Cheese
 *
 * Requires mc-auth.php for the console-facing routes.
 *
 * The shape of this
 * -----------------
 *   POST /mc/v1/orders                 public   customer places an order
 *   GET  /mc/v1/orders/{id}?code=...   public   customer checks their own order
 *   GET  /mc/v1/orders                 token    ROS Live Orders list
 *   POST /mc/v1/orders/{id}/status     token    staff advance an order
 *
 * Why WooCommerce rather than a table of our own: refunds, reporting, customer
 * history and stock all already exist there. A custom table would mean
 * rebuilding each of those by hand later, badly.
 *
 * Payment happens at the truck, so orders are created on-hold. Nothing here
 * takes money, and nothing here should ever be extended to without a proper
 * look at PCI scope.
 *
 * SECURITY NOTE — this is the only public write endpoint in the system.
 * Everything else is read-only or behind a token. The rules that matter:
 *
 *   - Prices are ALWAYS looked up from the product. A client-supplied price is
 *     ignored entirely. This is the single most important line of defence:
 *     without it, anyone can order a 200 AED platter for 1 fil.
 *   - Product ids must resolve to a real, published, purchasable product.
 *   - Quantities and line counts are capped, so a single request cannot create
 *     a 10,000-item order and exhaust memory.
 *   - Submissions are rate-limited per IP.
 *   - The collection code is random, not sequential, so one customer cannot
 *     read another's order by guessing the next number up.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const MC_ORDERS_EVENT_META = '_mc_event';
const MC_ORDERS_CODE_META  = '_mc_collection_code';
const MC_ORDERS_SOURCE_META = '_mc_source';
const MC_ORDERS_TRUCK_META  = '_mc_truck';

const MC_ORDERS_MAX_LINES    = 40;
const MC_ORDERS_MAX_QTY      = 20;
const MC_ORDERS_RATE_LIMIT   = 10;   // orders per window, per IP
const MC_ORDERS_RATE_WINDOW  = 600;  // 10 minutes

/** Longest free-text note accepted, per line and per order. */
const MC_ORDERS_MAX_NOTE = 200;

/**
 * The extras the apps offer, priced HERE rather than in the app.
 *
 * Same reasoning as product prices: anything the client sends can be edited,
 * so the server owns the number. The ids must match the catalogue in the iOS
 * OrderStore.AddOn and its Android equivalent. Add one there without adding
 * it here and the order is rejected outright, which is the intended failure:
 * a loud 422 beats silently dropping something the customer paid for.
 */
function mc_orders_addons() {
	return array(
		'extra-cheese' => array( 'name' => 'Extra Cheese',       'price' => 5 ),
		'extra-sauce'  => array( 'name' => 'Extra Sauce',        'price' => 2 ),
		'fries'        => array( 'name' => 'Fries (M)',          'price' => 15 ),
		'jollof-half'  => array( 'name' => 'Jollof Rice (Half)', 'price' => 12 ),
	);
}

/** The states an order moves through, in order. */
function mc_orders_states() {
	return array(
		'on-hold'    => 'Received',
		'processing' => 'Preparing',
		'completed'  => 'Collected',
		'cancelled'  => 'Cancelled',
	);
}

add_action( 'rest_api_init', 'mc_orders_routes' );
function mc_orders_routes() {

	// Public: the app places an order.
	register_rest_route( 'mc/v1', '/orders', array(
		array(
			'methods'             => 'POST',
			'callback'            => 'mc_orders_create',
			'permission_callback' => '__return_true',
		),
		array(
			'methods'             => 'GET',
			'callback'            => 'mc_orders_list',
			'permission_callback' => function_exists( 'mc_auth_require' )
				? mc_auth_require( 'orders', 'edit_shop_orders' )
				: '__return_false',
		),
	) );

	// Public, but only with the matching collection code.
	register_rest_route( 'mc/v1', '/orders/(?P<id>\d+)', array(
		'methods'             => 'GET',
		'callback'            => 'mc_orders_get_one',
		'permission_callback' => '__return_true',
	) );

	// Console: staff put an order on a truck. Assignment is manual on purpose:
	// with one truck it is noise, and with several the right rule is not
	// obvious until someone has watched a real event.
	register_rest_route( 'mc/v1', '/orders/(?P<id>\\d+)/truck', array(
		'methods'             => 'POST',
		'callback'            => 'mc_orders_set_truck',
		'permission_callback' => function_exists( 'mc_auth_require' )
			? mc_auth_require( 'orders', 'edit_shop_orders' )
			: '__return_false',
	) );

	// Console: staff advance an order.
	register_rest_route( 'mc/v1', '/orders/(?P<id>\d+)/status', array(
		'methods'             => 'POST',
		'callback'            => 'mc_orders_set_status',
		'permission_callback' => function_exists( 'mc_auth_require' )
			? mc_auth_require( 'orders', 'edit_shop_orders' )
			: '__return_false',
	) );
}

/* -------------------------------------------------------------------------
 * Rate limiting
 * ---------------------------------------------------------------------- */

function mc_orders_client_ip() {
	// REMOTE_ADDR only — forwarded headers are attacker-controlled and would
	// let anyone reset their own counter.
	return isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : 'unknown';
}

function mc_orders_rate_limited() {
	$key   = 'mc_orders_rate_' . md5( mc_orders_client_ip() );
	$count = (int) get_transient( $key );
	if ( $count >= MC_ORDERS_RATE_LIMIT ) {
		return true;
	}
	set_transient( $key, $count + 1, MC_ORDERS_RATE_WINDOW );
	return false;
}

/* -------------------------------------------------------------------------
 * Collection code
 * ---------------------------------------------------------------------- */

/**
 * Tidies a phone number, or returns '' when it is not usable.
 *
 * Kept deliberately permissive. The number exists so somebody can ring or
 * text a customer whose food is ready, and being strict about formatting
 * would reject real numbers written in ways people actually write them —
 * "050 123 4567", "+971 50 123 4567", "(050) 123-4567" all mean the same.
 *
 * So: strip everything that is not a digit, keep a leading + if one was
 * there, then sanity-check the length against the E.164 range of 7 to 15
 * digits. That rejects "12" and a pasted paragraph without pretending to
 * know which numbering plans are valid in every country we might trade in.
 */
function mc_orders_clean_phone( $raw ) {
	$raw = trim( (string) $raw );
	if ( '' === $raw ) {
		return '';
	}

	/* Arabic-Indic and Persian numerals first. We trade in the UAE, so a
	   customer on an Arabic keyboard typing ٠٥٠١٢٣٤٥٦٧ is ordinary, not an
	   edge case — and because the strip below works on bytes, every one of
	   those digits would otherwise be discarded and the order refused for
	   having no number at all. */
	$raw = strtr( $raw, array(
		'٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
		'٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
		'۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
		'۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
	) );

	$plus   = ( 0 === strpos( $raw, '+' ) );
	$digits = preg_replace( '/\D+/', '', $raw );
	$len    = strlen( $digits );

	if ( $len < 7 || $len > 15 ) {
		return '';
	}

	return ( $plus ? '+' : '' ) . $digits;
}

/**
 * Whether the app that sent this order says it collects a phone number.
 *
 * Old builds do not send the header and so are never held to the
 * requirement. This is the whole reason the check exists: the moment the
 * server starts demanding a field, every copy of the app already installed
 * that does not send it starts failing at checkout, and those people have
 * no way to fix it except waiting for a release.
 *
 * Delete this once no build without the header is still in use.
 */
function mc_orders_client_collects_phone( WP_REST_Request $request ) {
	return '1' === trim( (string) $request->get_header( 'x_mc_collects_phone' ) );
}

/**
 * Short, human-readable, and random.
 *
 * Random rather than sequential on purpose: the code is what lets a customer
 * read their own order back, so a guessable code would let anyone walk the
 * list. Four digits is enough to say out loud at a truck window while the
 * order id has to match too.
 */
function mc_orders_make_code() {
	for ( $attempt = 0; $attempt < 12; $attempt++ ) {
		$code = 'MC-' . str_pad( (string) random_int( 1000, 9999 ), 4, '0', STR_PAD_LEFT );

		$existing = wc_get_orders( array(
			'limit'      => 1,
			'return'     => 'ids',
			'meta_key'   => MC_ORDERS_CODE_META,
			'meta_value' => $code,
			'date_after' => date( 'Y-m-d', strtotime( '-2 days' ) ),
		) );
		if ( empty( $existing ) ) {
			return $code;
		}
	}
	// Collisions only matter within a couple of days; fall back to something
	// certainly unique rather than looping forever.
	return 'MC-' . strtoupper( substr( wp_generate_password( 6, false, false ), 0, 6 ) );
}

/* -------------------------------------------------------------------------
 * Create
 * ---------------------------------------------------------------------- */

function mc_orders_create( WP_REST_Request $request ) {

	if ( ! function_exists( 'wc_create_order' ) ) {
		return new WP_Error( 'mc_no_woo', 'WooCommerce is not active.', array( 'status' => 503 ) );
	}
	if ( mc_orders_rate_limited() ) {
		return new WP_Error( 'mc_rate_limited', 'Too many orders from this device. Try again shortly.', array( 'status' => 429 ) );
	}

	$body = $request->get_json_params();
	if ( ! is_array( $body ) || empty( $body['items'] ) || ! is_array( $body['items'] ) ) {
		return new WP_Error( 'mc_no_items', 'Send an items array.', array( 'status' => 400 ) );
	}
	if ( count( $body['items'] ) > MC_ORDERS_MAX_LINES ) {
		return new WP_Error( 'mc_too_many_lines', 'That order has too many separate items.', array( 'status' => 422 ) );
	}

	// Resolve every line before creating anything, so a bad id cannot leave a
	// half-built order behind.
	$lines = array();
	foreach ( $body['items'] as $item ) {
		$id  = isset( $item['product_id'] ) ? absint( $item['product_id'] ) : 0;
		$qty = isset( $item['quantity'] ) ? absint( $item['quantity'] ) : 0;

		if ( ! $id || $qty < 1 ) {
			return new WP_Error( 'mc_bad_line', 'Every item needs a product_id and a quantity.', array( 'status' => 422 ) );
		}
		if ( $qty > MC_ORDERS_MAX_QTY ) {
			return new WP_Error( 'mc_qty_too_high', 'Maximum ' . MC_ORDERS_MAX_QTY . ' of any one item.', array( 'status' => 422 ) );
		}

		$product = wc_get_product( $id );
		if ( ! $product || 'publish' !== $product->get_status() || ! $product->is_purchasable() ) {
			return new WP_Error(
				'mc_unknown_product',
				'One of those items is no longer available.',
				array( 'status' => 422 )
			);
		}

		// Extras resolve the same way: the app sends ids, the server owns the
		// prices. An unknown id is rejected rather than quietly dropped.
		$catalogue = mc_orders_addons();
		$chosen    = array();
		if ( ! empty( $item['add_ons'] ) && is_array( $item['add_ons'] ) ) {
			foreach ( $item['add_ons'] as $addon_id ) {
				$addon_id = sanitize_key( $addon_id );
				if ( ! isset( $catalogue[ $addon_id ] ) ) {
					return new WP_Error(
						'mc_unknown_addon',
						'One of those extras is no longer available.',
						array( 'status' => 422 )
					);
				}
				$chosen[] = $addon_id;
			}
		}

		$note = isset( $item['note'] ) ? sanitize_text_field( $item['note'] ) : '';
		if ( strlen( $note ) > MC_ORDERS_MAX_NOTE ) {
			$note = substr( $note, 0, MC_ORDERS_MAX_NOTE );
		}

		// NOTE: the price comes from the product, never from the request.
		$lines[] = array(
			'product' => $product,
			'qty'     => $qty,
			'add_ons' => $chosen,
			'note'    => $note,
		);
	}

	$order = wc_create_order();
	if ( is_wp_error( $order ) ) {
		return $order;
	}

	$catalogue   = mc_orders_addons();
	$addon_count = array();

	foreach ( $lines as $line ) {
		$item_id = $order->add_product( $line['product'], $line['qty'] );

		// Written onto the line itself so the extras show up on the packing
		// slip and the WooCommerce order screen, not only in the API response.
		$item_obj = $item_id ? $order->get_item( $item_id ) : null;
		if ( $item_obj ) {
			if ( ! empty( $line['add_ons'] ) ) {
				$labels = array();
				foreach ( $line['add_ons'] as $addon_id ) {
					$labels[] = $catalogue[ $addon_id ]['name'];
					$running  = isset( $addon_count[ $addon_id ] ) ? $addon_count[ $addon_id ] : 0;
					$addon_count[ $addon_id ] = $running + $line['qty'];
				}
				$item_obj->add_meta_data( 'Extras', implode( ', ', $labels ), true );
			}
			if ( $line['note'] ) {
				$item_obj->add_meta_data( 'Note', $line['note'], true );
			}
			$item_obj->save();
		}
	}

	// Each extra becomes one fee line, priced from the table above, so the
	// total the customer saw in the app is the total WooCommerce holds. Doing
	// it as a fee rather than a client-priced line keeps the price server-side.
	foreach ( $addon_count as $addon_id => $addon_qty ) {
		$amount = $catalogue[ $addon_id ]['price'] * $addon_qty;
		$fee    = new WC_Order_Item_Fee();
		$fee->set_name( $catalogue[ $addon_id ]['name'] . ( $addon_qty > 1 ? ' x' . $addon_qty : '' ) );
		$fee->set_amount( (string) $amount );
		$fee->set_total( (string) $amount );
		$fee->set_tax_status( 'none' );
		$order->add_item( $fee );
	}

	$name  = isset( $body['customer_name'] ) ? sanitize_text_field( $body['customer_name'] ) : '';
	$phone = mc_orders_clean_phone( isset( $body['customer_phone'] ) ? $body['customer_phone'] : '' );

	/* A build that says it collects a phone number must send one. Builds that
	   predate the requirement keep working untouched — enforcing on everyone
	   the moment this deploys would fail every order from the copies already
	   on testers' phones, which is a worse outcome than a few orders without
	   a number. The header goes away once no old build is in the wild. */
	if ( '' === $phone && mc_orders_client_collects_phone( $request ) ) {
		return new WP_Error(
			'mc_phone_required',
			'A contact number is needed so we can tell you when the order is ready.',
			array( 'status' => 422 )
		);
	}

	if ( $name ) {
		$order->set_billing_first_name( $name );
	}
	if ( $phone ) {
		$order->set_billing_phone( $phone );
	}

	$order_note = isset( $body['note'] ) ? sanitize_textarea_field( $body['note'] ) : '';
	if ( $order_note ) {
		$order->set_customer_note( substr( $order_note, 0, MC_ORDERS_MAX_NOTE ) );
	}

	$code = mc_orders_make_code();
	$order->update_meta_data( MC_ORDERS_CODE_META, $code );
	// The collection point. When the app sends none (no point picked, or
	// a build that predates the picker), file it under the published
	// default event rather than leaving the order unattached.
	$event = isset( $body['event'] ) ? sanitize_key( $body['event'] ) : '';
	if ( '' === $event ) {
		$cfg = get_option( 'mc_app_config' );
		if ( is_array( $cfg ) && ! empty( $cfg['default_event'] ) ) {
			$event = sanitize_key( $cfg['default_event'] );
		}
	}
	$order->update_meta_data( MC_ORDERS_EVENT_META, $event );
	$order->update_meta_data( MC_ORDERS_SOURCE_META, isset( $body['platform'] ) ? sanitize_key( $body['platform'] ) : 'app' );

	// Recorded for the truck, not charged here. Payment happens in person.
	$method = isset( $body['payment_method'] ) ? sanitize_text_field( $body['payment_method'] ) : 'at_truck';
	$order->set_payment_method_title( $method === 'apple_pay' ? 'Apple Pay (at truck)' : 'Card or cash (at truck)' );
	// The id itself, so the console can split takings by method.
	$order->update_meta_data( '_mc_payment_method', $method );

	$order->calculate_totals();
	$order->set_status( 'on-hold', 'Placed from the customer app. Payment on collection.' );
	$order->save();

	return new WP_REST_Response( array(
		'ok'              => true,
		'order_id'        => $order->get_id(),
		'collection_code' => $code,
		'status'          => 'on-hold',
		'status_label'    => 'Received',
		'total'           => $order->get_total(),
		'currency'        => $order->get_currency(),
	), 201 );
}

/* -------------------------------------------------------------------------
 * Read one — the customer checking their own order
 * ---------------------------------------------------------------------- */

function mc_orders_get_one( WP_REST_Request $request ) {
	$order = wc_get_order( (int) $request['id'] );
	$code  = (string) $request->get_param( 'code' );

	// Both must match. The id alone is guessable by counting; the code alone
	// could collide. Together they are the customer's capability to read it.
	if ( ! $order || ! $code || ! hash_equals( (string) $order->get_meta( MC_ORDERS_CODE_META ), $code ) ) {
		return new WP_Error( 'mc_not_found', 'No order matches that code.', array( 'status' => 404 ) );
	}

	return mc_orders_payload( $order );
}

/* -------------------------------------------------------------------------
 * List — ROS Live Orders
 * ---------------------------------------------------------------------- */

function mc_orders_list( WP_REST_Request $request ) {
	if ( ! function_exists( 'wc_get_orders' ) ) {
		return new WP_Error( 'mc_no_woo', 'WooCommerce is not active.', array( 'status' => 503 ) );
	}

	$args = array(
		'limit'   => min( 100, max( 1, (int) ( $request->get_param( 'per_page' ) ?: 50 ) ) ),
		'orderby' => 'date',
		'order'   => 'DESC',
	);

	$status = $request->get_param( 'status' );
	if ( $status && array_key_exists( $status, mc_orders_states() ) ) {
		$args['status'] = $status;
	}

	// Only orders that came from the apps, so the console is not cluttered
	// with website orders it has no part in.
	$args['meta_key']     = MC_ORDERS_SOURCE_META;
	$args['meta_compare'] = 'EXISTS';

	$event = $request->get_param( 'event' );
	$truck = $request->get_param( 'truck' );

	$out = array();
	foreach ( wc_get_orders( $args ) as $order ) {
		if ( $event && $order->get_meta( MC_ORDERS_EVENT_META ) !== $event ) {
			continue;
		}
		// 'unassigned' is a real filter, not an absent one: it is the queue
		// someone works through at the start of a service.
		$on = $order->get_meta( MC_ORDERS_TRUCK_META );
		if ( 'unassigned' === $truck && $on ) {
			continue;
		}
		if ( $truck && 'unassigned' !== $truck && $on !== $truck ) {
			continue;
		}
		$out[] = mc_orders_payload( $order );
	}

	return $out;
}

/* -------------------------------------------------------------------------
 * Advance
 * ---------------------------------------------------------------------- */

function mc_orders_set_status( WP_REST_Request $request ) {
	$order = wc_get_order( (int) $request['id'] );
	if ( ! $order ) {
		return new WP_Error( 'mc_not_found', 'No order with that id.', array( 'status' => 404 ) );
	}

	$body   = $request->get_json_params();
	$status = isset( $body['status'] ) ? sanitize_key( $body['status'] ) : '';
	$states = mc_orders_states();

	if ( ! array_key_exists( $status, $states ) ) {
		return new WP_Error(
			'mc_bad_status',
			'Status must be one of: ' . implode( ', ', array_keys( $states ) ),
			array( 'status' => 422 )
		);
	}

	$user = wp_get_current_user();
	$order->set_status( $status, 'Changed from the ROS console by ' . ( $user->user_login ?: 'a token' ) . '.' );
	$order->save();

	return mc_orders_payload( $order );
}

/* -------------------------------------------------------------------------
 * Assign to a truck
 * ---------------------------------------------------------------------- */

function mc_orders_set_truck( WP_REST_Request $request ) {
	$order = wc_get_order( (int) $request['id'] );
	if ( ! $order ) {
		return new WP_Error( 'mc_not_found', 'No order with that id.', array( 'status' => 404 ) );
	}

	$body  = $request->get_json_params();
	$truck = isset( $body['truck'] ) ? sanitize_key( $body['truck'] ) : '';

	// An empty value un-assigns, which is how a mistake gets undone.
	if ( '' === $truck ) {
		$order->delete_meta_data( MC_ORDERS_TRUCK_META );
		$order->add_order_note( 'Taken off its truck from the ROS console.' );
		$order->save();
		return mc_orders_payload( $order );
	}

	// The truck has to be one actually published to this event. Without that
	// check a typo silently sends an order to a truck at another venue, and
	// nobody finds out until a customer is standing at the wrong window.
	$config = get_option( MC_APP_CONFIG_OPTION );
	$fleet  = ( is_array( $config ) && ! empty( $config['fleet'] ) ) ? $config['fleet'] : array();
	$event  = $order->get_meta( MC_ORDERS_EVENT_META );

	$match = null;
	foreach ( $fleet as $candidate ) {
		if ( $candidate['id'] === $truck ) {
			$match = $candidate;
			break;
		}
	}

	if ( ! $match ) {
		return new WP_Error(
			'mc_unknown_truck',
			'That truck is not in the published fleet. Publish from Food Trucks first.',
			array( 'status' => 422 )
		);
	}
	if ( $event && ! in_array( $event, (array) $match['events'], true ) ) {
		return new WP_Error(
			'mc_truck_not_at_event',
			sprintf( '%s is not deployed to this event.', $match['name'] ? $match['name'] : $truck ),
			array( 'status' => 422 )
		);
	}

	$order->update_meta_data( MC_ORDERS_TRUCK_META, $truck );
	$order->add_order_note( sprintf( 'Assigned to %s from the ROS console.', $match['name'] ? $match['name'] : $truck ) );
	$order->save();

	return mc_orders_payload( $order );
}

/* -------------------------------------------------------------------------
 * Shared shape
 * ---------------------------------------------------------------------- */

/* The method the guest chose. Orders placed before it was stored as meta
   only carry the display title, so fall back to reading that. */
function mc_orders_payment_method( $order ) {
	$m = (string) $order->get_meta( '_mc_payment_method' );
	if ( '' !== $m ) {
		return $m;
	}
	if ( '' !== (string) $order->get_payment_method() ) {
		return $order->get_payment_method();
	}
	$title = (string) $order->get_payment_method_title();
	if ( false !== stripos( $title, 'apple pay' ) ) {
		return 'apple_pay';
	}
	return '' !== $title ? 'at_truck' : '';
}

function mc_orders_payload( $order ) {
	$states = mc_orders_states();
	$status = $order->get_status();

	$items = array();
	foreach ( $order->get_items() as $item ) {
		$items[] = array(
			'name'     => $item->get_name(),
			'quantity' => $item->get_quantity(),
			'total'    => $item->get_total(),
			'extras'   => (string) $item->get_meta( 'Extras' ),
			'note'     => (string) $item->get_meta( 'Note' ),
		);
	}

	// Extras live on fee lines, so the console can show them beside the food.
	$fees = array();
	foreach ( $order->get_items( 'fee' ) as $fee_item ) {
		$fees[] = array(
			'name'  => $fee_item->get_name(),
			'total' => $fee_item->get_total(),
		);
	}

	return array(
		'order_id'        => $order->get_id(),
		'collection_code' => $order->get_meta( MC_ORDERS_CODE_META ),
		'event'           => $order->get_meta( MC_ORDERS_EVENT_META ),
		'platform'        => $order->get_meta( MC_ORDERS_SOURCE_META ),
		'truck'           => $order->get_meta( MC_ORDERS_TRUCK_META ),
		'status'          => $status,
		'status_label'    => isset( $states[ $status ] ) ? $states[ $status ] : ucfirst( $status ),
		'customer'        => $order->get_billing_first_name(),
		'phone'           => $order->get_billing_phone(),
		'items'           => $items,
		'fees'            => $fees,
		'total'           => $order->get_total(),
		'currency'        => $order->get_currency(),
		// How the guest said they would pay (at_truck, card, apple_pay,
		// payment_link). The dashboard splits takings by this.
		'payment_method'  => mc_orders_payment_method( $order ),
		'placed_at'       => $order->get_date_created() ? $order->get_date_created()->date( 'c' ) : null,
		// Set when the order is marked Collected; placed -> collected is the
		// prep time the dashboard averages.
		'completed_at'    => $order->get_date_completed() ? $order->get_date_completed()->date( 'c' ) : null,
	);
}
