<?php
/**
 * Plugin Name: Melting Cheese — Console State
 * Description: Stores the ROS console's working state on the server, so every operator on every device sees the same data.
 * Version:     1.0.0
 * Author:      Melting Cheese
 *
 * Requires mc-auth.php.
 *
 * Why this exists
 * ---------------
 * Every screen in the ROS console used to read from the browser's
 * localStorage and fall back to a hardcoded demo default. Nothing was stored
 * server-side, so a second operator opening the console on their own device
 * got a factory-fresh install: demo events, demo trucks, demo banners, no
 * products and no orders. The setup only ever existed in one browser, and
 * clearing that browser would have destroyed it.
 *
 *   GET  /mc/v1/console-state   token   read the shared state
 *   POST /mc/v1/console-state   token   write some or all of it
 *   PUT  /mc/v1/console-state   token   same as POST
 *
 * Concurrency
 * -----------
 * Revisions are per SECTION, not per document. Two people working at once is
 * the normal case here, and a single document revision would mean somebody
 * editing trucks gets rejected because somebody else touched banners. A
 * writer sends the revision it read for each section it is changing; if that
 * section has moved on, only that section is refused, and the current copy
 * comes back with the refusal so the console can show what actually happened
 * rather than an error nobody can act on.
 *
 * SECRETS ARE NOT STORED HERE
 * ---------------------------
 * This option is plaintext in wp_options and is readable by any token with
 * the publish scope. WooCommerce consumer keys and secrets, API tokens and
 * passwords therefore stay per-device in the operator's own browser and are
 * stripped from anything written here — see mc_console_strip_secrets().
 * Sharing configuration is the goal; sharing credentials is not.
 *
 * Scope choice
 * ------------
 * Gated on the existing 'publish' scope rather than a new 'console' one.
 * Adding a scope would mean every already-issued token lacks it, and a token
 * cannot be edited — Timothy would have to reissue and re-paste the console
 * credential just to keep working. 'publish' is also the honest match: this
 * is the draft behind what gets published, and a token that can publish can
 * already change everything the apps show. The kitchen tablet's orders-only
 * token correctly gets nothing here.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const MC_CONSOLE_OPTION = 'mc_console_state';

/** Generous next to the ~16 KB a full console currently occupies, but small
    enough that a runaway client cannot fill the options table. */
const MC_CONSOLE_MAX_BYTES = 524288; // 512 KB

/**
 * The sections the console may store. An unknown key is refused rather than
 * ignored: silently dropping a section would look to the operator like a
 * save that worked.
 */
function mc_console_sections() {
	return array(
		'events',
		'crates',
		'trucks',
		'banner_packs',
		'home_layouts',
		'synced_products',
		'app_releases',
		'publish_state',
		'connectors',
	);
}

/**
 * Keys that must never be written here, at any depth. Matched
 * case-insensitively against the key name.
 *
 * 'ck' and 'cs' are the WooCommerce consumer key and secret as the console
 * names them in its connectors object.
 *
 * Deliberately NOT in this list: the bare words 'key' and 'pass'. Sections
 * are stored as maps, so this runs against map keys as well as field names,
 * and blanking anything that happened to be keyed "key" would corrupt real
 * data to guard against a credential nothing in this system names that way.
 * A strip list that is too eager is a data-loss bug wearing a security hat.
 */
function mc_console_secret_keys() {
	return array(
		'ck',
		'cs',
		'token',
		'secret',
		'password',
		'api_key',
		'apikey',
		'consumer_key',
		'consumer_secret',
	);
}

/* -------------------------------------------------------------------------
 * Storage
 * ---------------------------------------------------------------------- */

function mc_console_blank() {
	return array(
		'revisions'  => array(),
		'sections'   => array(),
		'updated_at' => null,
		'updated_by' => null,
	);
}

function mc_console_read() {
	$state = get_option( MC_CONSOLE_OPTION );
	if ( ! is_array( $state ) || ! isset( $state['sections'] ) || ! is_array( $state['sections'] ) ) {
		return mc_console_blank();
	}
	if ( ! isset( $state['revisions'] ) || ! is_array( $state['revisions'] ) ) {
		$state['revisions'] = array();
	}
	return $state;
}

/**
 * Autoload is off on purpose. This can reach a few hundred KB with synced
 * products in it, and autoloading that onto every single page load of the
 * public website — which never reads it — would be a real cost.
 */
function mc_console_write( $state ) {
	update_option( MC_CONSOLE_OPTION, $state, false );
}

/* -------------------------------------------------------------------------
 * Cleaning
 * ---------------------------------------------------------------------- */

/**
 * Removes credential-shaped keys at any depth.
 *
 * Returns the cleaned value and, by reference, the names it removed, so the
 * response can tell the operator their secret was not stored rather than
 * leaving them to assume it was. Silently dropping it would be worse than
 * refusing: they would believe the other device has push access when it
 * does not.
 */
function mc_console_strip_secrets( $value, &$removed = array(), $depth = 0 ) {
	// A structure this deep is not something the console produces. Refusing
	// to recurse further is a cheap guard against a crafted payload.
	if ( $depth > 12 || ! is_array( $value ) ) {
		return $value;
	}

	$secrets = mc_console_secret_keys();
	$out     = array();

	foreach ( $value as $key => $item ) {
		if ( is_string( $key ) && in_array( strtolower( $key ), $secrets, true ) ) {
			// Kept as an empty string rather than dropped, so the shape the
			// console expects survives the round trip.
			$out[ $key ] = '';
			$removed[]   = $key;
			continue;
		}
		$out[ $key ] = mc_console_strip_secrets( $item, $removed, $depth + 1 );
	}

	return $out;
}

/* -------------------------------------------------------------------------
 * Routes
 * ---------------------------------------------------------------------- */

add_action( 'rest_api_init', 'mc_console_routes' );
function mc_console_routes() {

	if ( ! function_exists( 'mc_auth_require' ) ) {
		return;
	}

	$gate = mc_auth_require( 'publish', 'edit_posts' );

	register_rest_route( 'mc/v1', '/console-state', array(
		array(
			'methods'             => 'GET',
			'callback'            => 'mc_console_get',
			'permission_callback' => $gate,
		),
		// POST as well as PUT because some shared hosts and mod_security
		// rulesets drop PUT outright, and losing the console's only write
		// path to a firewall rule is not a failure worth risking.
		array(
			'methods'             => array( 'POST', 'PUT' ),
			'callback'            => 'mc_console_post',
			'permission_callback' => $gate,
		),
	) );
}

function mc_console_get( WP_REST_Request $request ) {
	$state = mc_console_read();

	return array(
		'revisions'  => (object) $state['revisions'],
		'sections'   => (object) $state['sections'],
		'updated_at' => $state['updated_at'],
		'updated_by' => $state['updated_by'],
		// Tells a console with local data that the server has never been
		// written to, so it can offer to seed from the browser instead of
		// replacing a real setup with nothing.
		'empty'      => empty( $state['sections'] ),
	);
}

function mc_console_post( WP_REST_Request $request ) {

	if ( strlen( (string) $request->get_body() ) > MC_CONSOLE_MAX_BYTES ) {
		return new WP_Error(
			'mc_console_too_big',
			'That console state is larger than ' . ( MC_CONSOLE_MAX_BYTES / 1024 ) . ' KB.',
			array( 'status' => 413 )
		);
	}

	$body = $request->get_json_params();
	if ( ! is_array( $body ) || ! isset( $body['sections'] ) || ! is_array( $body['sections'] ) ) {
		return new WP_Error( 'mc_console_no_sections', 'Send a sections object.', array( 'status' => 400 ) );
	}

	$allowed  = mc_console_sections();
	$unknown  = array_diff( array_keys( $body['sections'] ), $allowed );
	if ( ! empty( $unknown ) ) {
		return new WP_Error(
			'mc_console_unknown_section',
			'Unknown section: ' . implode( ', ', $unknown ) . '. Known sections are: ' . implode( ', ', $allowed ) . '.',
			array( 'status' => 422 )
		);
	}

	$sent_revisions = isset( $body['revisions'] ) && is_array( $body['revisions'] ) ? $body['revisions'] : array();

	$state    = mc_console_read();
	$conflict = array();
	$written  = array();
	$removed  = array();

	foreach ( $body['sections'] as $name => $value ) {

		$current_revision = isset( $state['revisions'][ $name ] ) ? (int) $state['revisions'][ $name ] : 0;

		/* A writer must say which revision it is replacing. Revision 0 means
		   "I believe this section does not exist yet", which is how a first
		   seed is expressed — and it is refused if the section has since
		   been created, rather than quietly overwriting it. */
		$claimed = isset( $sent_revisions[ $name ] ) ? (int) $sent_revisions[ $name ] : null;
		if ( null === $claimed ) {
			return new WP_Error(
				'mc_console_no_revision',
				'Section "' . $name . '" was sent without the revision it is replacing.',
				array( 'status' => 422 )
			);
		}

		if ( $claimed !== $current_revision ) {
			$conflict[ $name ] = array(
				'expected' => $claimed,
				'actual'   => $current_revision,
			);
			continue;
		}

		$state['sections'][ $name ]  = mc_console_strip_secrets( $value, $removed );
		$state['revisions'][ $name ] = $current_revision + 1;
		$written[]                   = $name;
	}

	if ( ! empty( $written ) ) {
		$user                 = wp_get_current_user();
		$state['updated_at']  = gmdate( 'c' );
		$state['updated_by']  = $user->user_login ? $user->user_login : 'a token';
		mc_console_write( $state );
	}

	$response = array(
		'ok'         => empty( $conflict ),
		'written'    => $written,
		'revisions'  => (object) $state['revisions'],
		'updated_at' => $state['updated_at'],
		'updated_by' => $state['updated_by'],
	);

	// Named so the operator can be told plainly, rather than finding out
	// later that their push credential never made it.
	if ( ! empty( $removed ) ) {
		$response['secrets_not_stored'] = array_values( array_unique( $removed ) );
	}

	if ( ! empty( $conflict ) ) {
		// 409, and the sections that did not conflict have still been saved.
		// An all-or-nothing refusal would throw away good work because of an
		// unrelated section.
		$response['conflict'] = $conflict;
		$response['sections'] = (object) array_intersect_key(
			$state['sections'],
			$conflict
		);
		return new WP_REST_Response( $response, 409 );
	}

	return new WP_REST_Response( $response, 200 );
}
