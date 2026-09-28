<?php
/**
 * Plugin Name: Melting Cheese — Console Login
 * Description: Username + password login for the ROS console. Mints a short-lived session token so people stop pasting long-lived API keys into browsers.
 * Version:     1.0.0
 *
 * Why this exists
 * ---------------
 * Until now the console was opened by pasting an API token — a credential
 * with no expiry, shared by copy-paste, that had to be reissued when a
 * device was lost. Fine for a build server; wrong for a person.
 *
 * A person now logs in with the WordPress account they already have. On a
 * correct password this mints a token exactly like mc-auth.php's API tokens
 * (same store, same hash, same scope + capability checks on every route),
 * with two differences: it carries an expiry, and it is revoked by Sign Out.
 * Nothing downstream had to change — every existing mc/v1 route accepts a
 * session token because it IS a token.
 *
 * API tokens are not removed by this plugin. They remain the right credential
 * for machines (Codemagic, kitchen tablets) — a machine cannot type a
 * password — and are issued and revoked from Users → API Tokens as before.
 *
 * What is deliberately NOT here
 * -----------------------------
 * - No password reset. That stays in WordPress (wp-login.php?action=lostpassword)
 *   where the email flow already exists and is tested.
 * - No account creation. Operators are WordPress users, made in wp-admin by
 *   an administrator. A console that can create its own admins is a console
 *   that will one day create one it should not have.
 * - No "remember this device" cookie. The session token in the browser is
 *   the whole of the session; there is nothing else to leak.
 *
 * Endpoints (all JSON, all HTTPS-only via mc-auth's check):
 *   POST /wp-json/mc/v1/login    { username, password, remember }  -> session
 *   POST /wp-json/mc/v1/logout   (X-MC-Token)                        -> revoked
 *   GET  /wp-json/mc/v1/me       (X-MC-Token)                        -> who am I
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const MC_LOGIN_SESSION_SECS  = 12 * HOUR_IN_SECONDS;   // a shift
const MC_LOGIN_REMEMBER_SECS = 30 * DAY_IN_SECONDS;    // "remember me"
/* Minimum capability to use the console at all. Same bar mc-console.php
   sets for reading console state, so a login that succeeds is a login that
   can then actually do something. */
const MC_LOGIN_CAPABILITY    = 'edit_posts';

/* -------------------------------------------------------------------------
 * Role -> scopes. Scopes limit what a leaked session could do; WordPress
 * capabilities are still checked on every route on top of these.
 * ---------------------------------------------------------------------- */

function mc_login_scopes_for( WP_User $user ) {
	$roles = (array) $user->roles;
	if ( in_array( 'administrator', $roles, true ) || in_array( 'shop_manager', $roles, true ) ) {
		return array( 'publish', 'media', 'products', 'orders' );
	}
	// Editors and below can shape the app and the menu but not touch orders.
	return array( 'publish', 'media', 'products' );
}

function mc_login_role_label( WP_User $user ) {
	$roles = (array) $user->roles;
	if ( in_array( 'administrator', $roles, true ) ) {
		return 'Administrator';
	}
	if ( in_array( 'shop_manager', $roles, true ) ) {
		return 'Shop manager';
	}
	if ( in_array( 'editor', $roles, true ) ) {
		return 'Editor';
	}
	return ucfirst( (string) reset( $roles ) );
}

/* -------------------------------------------------------------------------
 * Housekeeping: expired sessions are dead weight in the token option and
 * clutter in the admin list. Swept on every login — cheap, and login is
 * exactly when someone is looking at that list.
 * ---------------------------------------------------------------------- */

function mc_login_sweep_expired() {
	if ( ! function_exists( 'mc_auth_all' ) ) {
		return;
	}
	$tokens  = mc_auth_all();
	$now     = time();
	$changed = false;
	foreach ( $tokens as $id => $t ) {
		if ( ! empty( $t['expires'] ) && strtotime( $t['expires'] ) < $now ) {
			unset( $tokens[ $id ] );
			$changed = true;
		}
	}
	if ( $changed ) {
		mc_auth_save_all( $tokens );
	}
}

/* -------------------------------------------------------------------------
 * Routes
 * ---------------------------------------------------------------------- */

add_action( 'rest_api_init', 'mc_login_routes' );
function mc_login_routes() {

	if ( ! function_exists( 'mc_auth_issue' ) ) {
		return; // mc-auth.php is the foundation; without it there is nothing to mint.
	}

	register_rest_route( 'mc/v1', '/login', array(
		'methods'             => 'POST',
		'callback'            => 'mc_login_post',
		'permission_callback' => '__return_true', // the password IS the permission check
	) );

	register_rest_route( 'mc/v1', '/logout', array(
		'methods'             => 'POST',
		'callback'            => 'mc_login_logout',
		'permission_callback' => '__return_true', // verify() reports its own failure
	) );

	register_rest_route( 'mc/v1', '/me', array(
		'methods'             => 'GET',
		'callback'            => 'mc_login_me',
		'permission_callback' => '__return_true',
	) );
}

function mc_login_post( WP_REST_Request $request ) {

	// Same HTTPS rule as every token route. A password over plain HTTP is
	// worse than a token over plain HTTP: it does not expire.
	$forwarded = isset( $_SERVER['HTTP_X_FORWARDED_PROTO'] )
		? strtolower( (string) $_SERVER['HTTP_X_FORWARDED_PROTO'] )
		: '';
	if ( ! is_ssl() && 'https' !== $forwarded ) {
		return new WP_Error( 'mc_login_insecure', 'Login requires HTTPS.', array( 'status' => 400 ) );
	}

	// Shares mc-auth's per-IP failure counter, so a password guesser and a
	// token guesser draw down the same 20-in-15-minutes budget.
	if ( mc_auth_is_throttled() ) {
		return new WP_Error( 'mc_login_throttled', 'Too many failed attempts. Try again in 15 minutes.', array( 'status' => 429 ) );
	}

	$body     = $request->get_json_params();
	$username = isset( $body['username'] ) ? trim( (string) $body['username'] ) : '';
	$password = isset( $body['password'] ) ? (string) $body['password'] : '';
	$remember = ! empty( $body['remember'] );

	if ( '' === $username || '' === $password ) {
		return new WP_Error( 'mc_login_missing', 'Enter your username (or email) and password.', array( 'status' => 400 ) );
	}

	// wp_authenticate accepts a username or an email address, runs the
	// same filters wp-login.php does, and returns WP_Error on failure.
	$user = wp_authenticate( $username, $password );

	if ( is_wp_error( $user ) ) {
		mc_auth_record_failure();
		// One message for "no such user" and "wrong password". Telling them
		// apart hands an attacker a list of valid usernames.
		return new WP_Error( 'mc_login_failed', 'That username or password is not right.', array( 'status' => 401 ) );
	}

	if ( ! user_can( $user, MC_LOGIN_CAPABILITY ) ) {
		// A real account, but not one that may use the console. Not a
		// throttle failure - the password was correct.
		return new WP_Error(
			'mc_login_not_operator',
			'This account exists but is not set up for the console. Ask an administrator to give it Editor, Shop manager or Administrator access.',
			array( 'status' => 403 )
		);
	}

	mc_auth_clear_failures();
	mc_login_sweep_expired();

	$ttl     = $remember ? MC_LOGIN_REMEMBER_SECS : MC_LOGIN_SESSION_SECS;
	$expires = gmdate( 'c', time() + $ttl );
	$agent   = isset( $_SERVER['HTTP_USER_AGENT'] ) ? substr( sanitize_text_field( (string) $_SERVER['HTTP_USER_AGENT'] ), 0, 60 ) : '';
	$label   = 'Session · ' . $user->user_login . ( $agent ? ' · ' . $agent : '' );

	$issued = mc_auth_issue( $label, $user->ID, mc_login_scopes_for( $user ) );

	// Mark it as a session: it expires, and Sign Out may revoke it.
	$tokens = mc_auth_all();
	if ( isset( $tokens[ $issued['id'] ] ) ) {
		$tokens[ $issued['id'] ]['kind']    = 'session';
		$tokens[ $issued['id'] ]['expires'] = $expires;
		mc_auth_save_all( $tokens );
	}

	return array(
		'ok'      => true,
		'token'   => $issued['token'],
		'expires' => $expires,
		'user'    => mc_login_user_summary( $user, mc_login_scopes_for( $user ) ),
	);
}

function mc_login_user_summary( WP_User $user, $scopes ) {
	return array(
		'login'   => $user->user_login,
		'name'    => $user->display_name ? $user->display_name : $user->user_login,
		'email'   => $user->user_email,
		'role'    => mc_login_role_label( $user ),
		'scopes'  => array_values( (array) $scopes ),
		'initials'=> mc_login_initials( $user->display_name ? $user->display_name : $user->user_login ),
	);
}

function mc_login_initials( $name ) {
	$parts = preg_split( '/\s+/', trim( (string) $name ) );
	$out   = '';
	foreach ( $parts as $p ) {
		if ( '' !== $p ) {
			$out .= strtoupper( mb_substr( $p, 0, 1 ) );
		}
		if ( strlen( $out ) >= 2 ) {
			break;
		}
	}
	return $out ? $out : 'MC';
}

function mc_login_me( WP_REST_Request $request ) {
	$token = mc_auth_verify();
	if ( is_wp_error( $token ) ) {
		return $token;
	}
	$user = wp_get_current_user();
	return array(
		'ok'      => true,
		'kind'    => isset( $token['kind'] ) ? $token['kind'] : 'api',
		'expires' => isset( $token['expires'] ) ? $token['expires'] : null,
		'user'    => mc_login_user_summary( $user, $token['scopes'] ),
	);
}

function mc_login_logout( WP_REST_Request $request ) {
	$token = mc_auth_verify();
	if ( is_wp_error( $token ) ) {
		// Already invalid is the outcome Sign Out wanted anyway.
		return array( 'ok' => true, 'revoked' => false );
	}
	if ( empty( $token['kind'] ) || 'session' !== $token['kind'] ) {
		// An API token is not a session. Refusing here stops a script that
		// happens to call logout from killing the build server's credential.
		return new WP_Error( 'mc_login_not_session', 'That is an API token, not a session. Revoke it from Users → API Tokens.', array( 'status' => 400 ) );
	}
	mc_auth_revoke( $token['id'] );
	return array( 'ok' => true, 'revoked' => true );
}
