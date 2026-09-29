<?php
/**
 * Plugin Name: Melting Cheese — Devices & Tokens
 * Description: Lets the ROS console issue, list and revoke API tokens — in particular the per-tablet `orders`-only tokens the kitchen app pairs with.
 * Version:     1.0.0
 *
 * Why
 * ---
 * Timothy's decision (kitchen handover s6.6): each kitchen tablet is paired
 * once with its own token, so losing a tablet means revoking one credential
 * and nothing else changes. Until now the only place to mint a token was
 * wp-admin -> Users -> API Tokens. This puts the same operation behind three
 * mc/v1 routes so the console can do it, with one deliberate narrowing:
 *
 *   Tokens issued through here are ALWAYS kind "device" and ALWAYS carry
 *   only the `orders` scope. The console cannot mint a publish/media/
 *   products credential; that stays a wp-admin action by an administrator.
 *
 * Who may call it
 * ---------------
 * A session or token with the `orders` scope AND the `manage_woocommerce`
 * capability - i.e. an Administrator or a Shop manager logged into the
 * console. A kitchen tablet's own token has `orders` but the account behind
 * it may be a shop manager too, so the routes additionally refuse any caller
 * whose token is itself kind "device": a tablet cannot mint tablets.
 *
 * Routes
 * ------
 *   GET    /wp-json/mc/v1/tokens          list (never the secret - it is not stored)
 *   POST   /wp-json/mc/v1/tokens          { label } -> { id, token (once), ... }
 *   DELETE /wp-json/mc/v1/tokens/{id}     revoke (any kind except the caller's own)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const MC_DEVICES_CAPABILITY = 'manage_woocommerce';
const MC_DEVICES_SCOPES     = array( 'orders' );

add_action( 'rest_api_init', 'mc_devices_routes' );
function mc_devices_routes() {
	if ( ! function_exists( 'mc_auth_issue' ) ) {
		return;
	}

	register_rest_route( 'mc/v1', '/tokens', array(
		array(
			'methods'             => 'GET',
			'callback'            => 'mc_devices_list',
			'permission_callback' => 'mc_devices_permission',
		),
		array(
			'methods'             => 'POST',
			'callback'            => 'mc_devices_issue',
			'permission_callback' => 'mc_devices_permission',
		),
	) );

	register_rest_route( 'mc/v1', '/tokens/(?P<id>[A-Za-z0-9]+)', array(
		'methods'             => 'DELETE',
		'callback'            => 'mc_devices_revoke',
		'permission_callback' => 'mc_devices_permission',
	) );
}

/** Same shape as mc_auth_require(), plus "not from a device token". */
function mc_devices_permission() {
	$token = mc_auth_verify();
	if ( is_wp_error( $token ) ) {
		return $token;
	}
	if ( ! in_array( 'orders', (array) $token['scopes'], true ) ) {
		return new WP_Error( 'mc_auth_scope', 'This token does not carry the "orders" scope.', array( 'status' => 403 ) );
	}
	if ( isset( $token['kind'] ) && 'device' === $token['kind'] ) {
		return new WP_Error( 'mc_devices_not_from_device', 'A paired device cannot manage tokens.', array( 'status' => 403 ) );
	}
	if ( ! current_user_can( MC_DEVICES_CAPABILITY ) ) {
		return new WP_Error( 'mc_auth_capability', 'Your account cannot manage devices.', array( 'status' => 403 ) );
	}
	return true;
}

/** Public view of a stored record: everything except the hash. */
function mc_devices_summary( $id, $t ) {
	$user = get_user_by( 'id', (int) $t['user_id'] );
	return array(
		'id'        => (string) $id,
		'label'     => isset( $t['label'] ) ? $t['label'] : '',
		'kind'      => isset( $t['kind'] ) ? $t['kind'] : 'api',
		'scopes'    => array_values( (array) $t['scopes'] ),
		'user'      => $user ? $user->user_login : null,
		'created'   => isset( $t['created'] ) ? $t['created'] : null,
		'last_used' => isset( $t['last_used'] ) ? $t['last_used'] : null,
		'last_ip'   => isset( $t['last_ip'] ) ? $t['last_ip'] : null,
		'expires'   => isset( $t['expires'] ) ? $t['expires'] : null,
	);
}

function mc_devices_list( WP_REST_Request $request ) {
	$current = mc_auth_verify();
	$out     = array();
	foreach ( mc_auth_all() as $id => $t ) {
		$row = mc_devices_summary( $id, $t );
		// So the console can mark "this is you" and refuse to offer Revoke on it.
		$row['current'] = ( ! is_wp_error( $current ) && $current['id'] === (string) $id );
		$out[] = $row;
	}
	// Newest first; devices before sessions before api, so the list reads as
	// "tablets" then "who is logged in" then "machines".
	$rank = array( 'device' => 0, 'session' => 1, 'api' => 2 );
	usort( $out, function ( $a, $b ) use ( $rank ) {
		$ra = isset( $rank[ $a['kind'] ] ) ? $rank[ $a['kind'] ] : 3;
		$rb = isset( $rank[ $b['kind'] ] ) ? $rank[ $b['kind'] ] : 3;
		if ( $ra !== $rb ) {
			return $ra - $rb;
		}
		return strcmp( (string) $b['created'], (string) $a['created'] );
	} );
	return $out;
}

function mc_devices_issue( WP_REST_Request $request ) {
	$body  = $request->get_json_params();
	$label = isset( $body['label'] ) ? sanitize_text_field( $body['label'] ) : '';
	if ( '' === trim( $label ) ) {
		return new WP_Error( 'mc_devices_label', 'Give the tablet a name (e.g. "Truck 1 pass").', array( 'status' => 422 ) );
	}
	if ( strlen( $label ) > 60 ) {
		$label = substr( $label, 0, 60 );
	}

	// Cap the number of live device tokens. Not a security control, a
	// sanity one: a list of forty "Tablet" entries means nobody is revoking.
	$devices = 0;
	foreach ( mc_auth_all() as $t ) {
		if ( isset( $t['kind'] ) && 'device' === $t['kind'] ) {
			$devices++;
		}
	}
	if ( $devices >= 20 ) {
		return new WP_Error( 'mc_devices_too_many', 'There are already 20 paired devices. Revoke one you no longer use first.', array( 'status' => 422 ) );
	}

	$user   = wp_get_current_user();
	$issued = mc_auth_issue( 'Tablet · ' . $label, $user->ID, MC_DEVICES_SCOPES );

	$tokens = mc_auth_all();
	if ( isset( $tokens[ $issued['id'] ] ) ) {
		$tokens[ $issued['id'] ]['kind']      = 'device';
		$tokens[ $issued['id'] ]['issued_by'] = $user->user_login;
		mc_auth_save_all( $tokens );
	}

	return new WP_REST_Response( array(
		'ok'     => true,
		'id'     => $issued['id'],
		// Shown ONCE. Not stored anywhere in plaintext; the console must
		// display it immediately and never again.
		'token'  => $issued['token'],
		'label'  => $label,
		'scopes' => MC_DEVICES_SCOPES,
	), 201 );
}

function mc_devices_revoke( WP_REST_Request $request ) {
	$id      = (string) $request['id'];
	$current = mc_auth_verify();
	if ( ! is_wp_error( $current ) && $current['id'] === $id ) {
		return new WP_Error( 'mc_devices_self', 'That is the session you are using now. Sign out instead.', array( 'status' => 422 ) );
	}
	$tokens = mc_auth_all();
	if ( ! isset( $tokens[ $id ] ) ) {
		return new WP_Error( 'mc_not_found', 'No token with that id.', array( 'status' => 404 ) );
	}
	mc_auth_revoke( $id );
	return array( 'ok' => true, 'revoked' => $id );
}
