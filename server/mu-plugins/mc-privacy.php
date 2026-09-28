<?php
/**
 * Plugin Name: Melting Cheese — Account Privacy
 * Description: Stops WordPress handing out the list of staff accounts. Closes user enumeration through the REST API, author archives, oEmbed and the login screens.
 * Version:     1.0.0
 *
 * What was leaking (checked 28 Sep 2026 on dev2, anonymously):
 *
 *   GET /wp-json/wp/v2/users            -> both accounts, with ids and slugs
 *   GET /?author=1                      -> 302 to /author/<slug>/
 *   GET /wp-json/oembed/1.0/embed?url=  -> "author_name"
 *   wp-login.php                        -> "Unknown username" vs "incorrect password"
 *   wp-login.php?action=lostpassword    -> "There is no account with that username"
 *
 * Every one of those turns "guess a password" into "guess a password for an
 * account you already know exists". This is a store with two admins and a
 * public login page; there is no reason for anyone outside to learn their
 * names.
 *
 * What this does NOT do: it does not touch the mc/v1 routes (they carry
 * their own token gate), does not hide anything from a logged-in user with
 * the list_users capability, and does not rename anyone. Renaming the
 * "admin" nicename is a separate, optional tidy-up in wp-admin.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* -------------------------------------------------------------------------
 * 1. REST: /wp/v2/users is for people who may list users, nobody else.
 *    Checked at dispatch, after WordPress has authenticated the request,
 *    so a logged-in administrator (or the block editor on their behalf)
 *    still works.
 * ---------------------------------------------------------------------- */

add_filter( 'rest_request_before_callbacks', 'mc_privacy_guard_users_route', 10, 3 );
function mc_privacy_guard_users_route( $response, $handler, $request ) {
	$route = $request->get_route();
	if ( 0 !== strpos( $route, '/wp/v2/users' ) ) {
		return $response;
	}
	if ( current_user_can( 'list_users' ) ) {
		return $response;
	}
	// 401 rather than 404: honest about why, gives away nothing about who.
	return new WP_Error(
		'rest_cannot_list_users',
		'You are not allowed to list users.',
		array( 'status' => 401 )
	);
}

/* -------------------------------------------------------------------------
 * 2. Author archives: /?author=N and /author/<slug>/ answer 404 to
 *    visitors. The site has no public authorship to show - it is a menu,
 *    not a blog - so nothing visible is lost.
 * ---------------------------------------------------------------------- */

add_action( 'template_redirect', 'mc_privacy_block_author_archive', 1 );
function mc_privacy_block_author_archive() {
	if ( is_admin() || is_user_logged_in() ) {
		return;
	}
	// The raw query var is checked as well as is_author(), because the
	// canonical redirect that turns ?author=1 into /author/admin/ can fire
	// before the main query has decided it is an author archive.
	if ( is_author() || isset( $_GET['author'] ) ) {
		global $wp_query;
		$wp_query->set_404();
		status_header( 404 );
		nocache_headers();
		$template = get_404_template();
		if ( $template ) {
			include $template;
			exit;
		}
		wp_die( 'Not found.', 'Not found', array( 'response' => 404 ) );
	}
}

// Belt and braces: never let the canonical redirect resolve ?author=N to a
// slug, even on a request that somehow gets past the check above.
add_filter( 'redirect_canonical', 'mc_privacy_no_author_canonical', 10, 2 );
function mc_privacy_no_author_canonical( $redirect_url, $requested_url ) {
	if ( ! is_user_logged_in() && isset( $_GET['author'] ) ) {
		return false;
	}
	return $redirect_url;
}

/* -------------------------------------------------------------------------
 * 3. oEmbed: the embed card names the author. Drop it.
 * ---------------------------------------------------------------------- */

add_filter( 'oembed_response_data', 'mc_privacy_strip_oembed_author' );
function mc_privacy_strip_oembed_author( $data ) {
	unset( $data['author_name'], $data['author_url'] );
	return $data;
}

/* -------------------------------------------------------------------------
 * 4. Login screens: one message whatever went wrong.
 *    The console's own /mc/v1/login already does this; wp-login.php did not.
 * ---------------------------------------------------------------------- */

add_filter( 'login_errors', 'mc_privacy_generic_login_error' );
function mc_privacy_generic_login_error( $message ) {
	// Keep messages that are not about credentials (e.g. "You are now
	// logged out", "Check your email"), which WordPress also routes here.
	if ( false !== stripos( $message, 'password' ) || false !== stripos( $message, 'username' ) || false !== stripos( $message, 'email address' ) ) {
		return 'The username or password is not right. <a href="' . esc_url( wp_lostpassword_url() ) . '">Lost your password?</a>';
	}
	return $message;
}

add_filter( 'lostpassword_errors', 'mc_privacy_generic_lostpassword_error' );
function mc_privacy_generic_lostpassword_error( $errors ) {
	if ( $errors instanceof WP_Error && $errors->has_errors() ) {
		$codes = $errors->get_error_codes();
		// "invalid_email" / "invalidcombo" are the enumerating ones; an
		// empty form ("empty_username") can keep its own message.
		if ( array_intersect( $codes, array( 'invalid_email', 'invalidcombo' ) ) ) {
			$errors = new WP_Error(
				'mc_privacy_neutral',
				'If an account matches what you entered, a reset link has been emailed to it.'
			);
		}
	}
	return $errors;
}

/* -------------------------------------------------------------------------
 * 5. The generator tag and the REST "link" header are minor, but the
 *    version string helps nobody but a scanner.
 * ---------------------------------------------------------------------- */

remove_action( 'wp_head', 'wp_generator' );
