<?php
/**
 * Plugin Name: Melting Cheese — API Tokens
 * Description: Issues and verifies the tokens the ROS console uses to publish app content, upload images and save products, so the console needs one credential instead of three.
 * Version:     1.0.0
 * Author:      Melting Cheese
 *
 * What this is, and what it deliberately is not
 * ---------------------------------------------
 * This file is a CREDENTIAL layer. It answers one question: "which WordPress
 * user is making this request?" It does NOT decide what that user is allowed
 * to do. Once a token is verified we call wp_set_current_user() and let
 * WordPress's own capability checks run exactly as they would for a browser
 * session. Reimplementing permissions here would be the easiest way to build
 * a hole, so we don't.
 *
 * Design notes worth keeping
 * --------------------------
 * - Tokens travel in X-MC-Token, not Authorization. Apache/CGI strips
 *   Authorization on this host, which is why mc-app-config.php carries a
 *   restore shim. A custom header sidesteps that class of bug entirely.
 * - Only a SHA-256 hash is stored. The plaintext is shown once at creation
 *   and is unrecoverable afterwards, same contract as an SSH key or a
 *   WordPress Application Password.
 * - Tokens are 32 bytes of CSPRNG output. That is far beyond brute force, but
 *   we throttle failures anyway because cheap defence in depth is still
 *   defence.
 * - Comparison is hash_equals(), not ===, so response timing cannot be used
 *   to walk the secret one character at a time.
 *
 * Honest limitation
 * -----------------
 * The ROS console stores this token in browser localStorage. That is exactly
 * as exposed as the Application Password it replaces: script injection in the
 * console leaks the credential either way. What scoping and revocation buy is
 * damage control after the fact, not prevention.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const MC_AUTH_OPTION       = 'mc_api_tokens';
const MC_AUTH_HEADER       = 'X-MC-Token';
const MC_AUTH_PREFIX       = 'mck_';
const MC_AUTH_SECRET_BYTES = 32;
const MC_AUTH_MAX_FAILS    = 20;    // per IP
const MC_AUTH_FAIL_WINDOW  = 900;   // 15 minutes

/**
 * Scopes exist so a token that leaks cannot necessarily do everything. They
 * are checked IN ADDITION to the WordPress capability, never instead of it.
 */
function mc_auth_scopes() {
	return array(
		'publish'  => 'Publish the app home layout and banners',
		'media'    => 'Upload images to the media library',
		'products' => 'Read and save products',
		'orders'   => 'Read app orders and advance them',
	);
}

/* -------------------------------------------------------------------------
 * Storage
 * ---------------------------------------------------------------------- */

/**
 * Every stored record, keyed by its public id.
 *
 * Shape: id => array( label, user_id, hash, scopes, created, last_used, last_ip )
 */
function mc_auth_all() {
	$tokens = get_option( MC_AUTH_OPTION );
	return is_array( $tokens ) ? $tokens : array();
}

function mc_auth_save_all( $tokens ) {
	// autoload = false: this is read on REST requests, not on every page view.
	update_option( MC_AUTH_OPTION, $tokens, false );
}

/**
 * Mints a token and returns the plaintext ONCE. The caller must show it to
 * the operator immediately; there is no way to retrieve it later.
 */
function mc_auth_issue( $label, $user_id, $scopes ) {
	$id     = wp_generate_password( 12, false, false );
	$secret = bin2hex( random_bytes( MC_AUTH_SECRET_BYTES ) );
	$plain  = MC_AUTH_PREFIX . $id . '_' . $secret;

	$valid  = array_keys( mc_auth_scopes() );
	$scopes = array_values( array_intersect( (array) $scopes, $valid ) );
	if ( empty( $scopes ) ) {
		$scopes = $valid;
	}

	$tokens = mc_auth_all();
	$tokens[ $id ] = array(
		'label'     => sanitize_text_field( $label ),
		'user_id'   => (int) $user_id,
		'hash'      => hash( 'sha256', $secret ),
		'scopes'    => $scopes,
		'created'   => current_time( 'c', true ),
		'last_used' => null,
		'last_ip'   => null,
	);
	mc_auth_save_all( $tokens );

	return array( 'id' => $id, 'token' => $plain );
}

function mc_auth_revoke( $id ) {
	$tokens = mc_auth_all();
	if ( ! isset( $tokens[ $id ] ) ) {
		return false;
	}
	unset( $tokens[ $id ] );
	mc_auth_save_all( $tokens );
	return true;
}

/* -------------------------------------------------------------------------
 * Throttling — blunts brute force without needing a database table.
 * ---------------------------------------------------------------------- */

function mc_auth_client_ip() {
	// REMOTE_ADDR only. Forwarded-for headers are attacker-controlled and
	// would let anyone reset their own throttle counter at will.
	return isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : 'unknown';
}

function mc_auth_fail_key() {
	return 'mc_auth_fails_' . md5( mc_auth_client_ip() );
}

function mc_auth_is_throttled() {
	return (int) get_transient( mc_auth_fail_key() ) >= MC_AUTH_MAX_FAILS;
}

function mc_auth_record_failure() {
	$key   = mc_auth_fail_key();
	$count = (int) get_transient( $key );
	set_transient( $key, $count + 1, MC_AUTH_FAIL_WINDOW );
}

function mc_auth_clear_failures() {
	delete_transient( mc_auth_fail_key() );
}

/* -------------------------------------------------------------------------
 * Verification
 * ---------------------------------------------------------------------- */

function mc_auth_presented_token() {
	// Header only. A token in a query string ends up in access logs, browser
	// history and referrer headers, so we never accept one there.
	$key = 'HTTP_' . str_replace( '-', '_', strtoupper( MC_AUTH_HEADER ) );
	return isset( $_SERVER[ $key ] ) ? trim( (string) $_SERVER[ $key ] ) : '';
}

/**
 * Resolves the presented token to a stored record, or a WP_Error.
 *
 * Returns the record with its id attached on success. Every failure path
 * returns the same generic message: telling a caller whether the id existed
 * would let them enumerate valid ids.
 */
function mc_auth_verify() {
	static $resolved = null;
	if ( null !== $resolved ) {
		return $resolved;
	}

	$deny = function ( $code = 'mc_auth_invalid', $status = 401, $message = null ) use ( &$resolved ) {
		$resolved = new WP_Error(
			$code,
			$message ? $message : 'Invalid or missing API token.',
			array( 'status' => $status )
		);
		return $resolved;
	};

	// A token sent over plain HTTP must be treated as already compromised.
	// Shared hosting often terminates TLS at a proxy, leaving is_ssl() false
	// on a request that really did arrive encrypted, so the forwarded header
	// is accepted as a second signal. It is client-controllable, but forging
	// it only lets an attacker weaken their OWN connection, not a victim's.
	$forwarded = isset( $_SERVER['HTTP_X_FORWARDED_PROTO'] )
		? strtolower( (string) $_SERVER['HTTP_X_FORWARDED_PROTO'] )
		: '';
	if ( ! is_ssl() && 'https' !== $forwarded ) {
		return $deny( 'mc_auth_insecure', 400, 'This endpoint requires HTTPS.' );
	}

	if ( mc_auth_is_throttled() ) {
		return $deny( 'mc_auth_throttled', 429, 'Too many failed attempts. Try again later.' );
	}

	$presented = mc_auth_presented_token();
	if ( '' === $presented || 0 !== strpos( $presented, MC_AUTH_PREFIX ) ) {
		return $deny();
	}

	$body = substr( $presented, strlen( MC_AUTH_PREFIX ) );
	$split = strpos( $body, '_' );
	if ( false === $split ) {
		mc_auth_record_failure();
		return $deny();
	}

	$id     = substr( $body, 0, $split );
	$secret = substr( $body, $split + 1 );
	$tokens = mc_auth_all();

	if ( ! isset( $tokens[ $id ] ) ) {
		mc_auth_record_failure();
		return $deny();
	}

	$record = $tokens[ $id ];

	// Timing-safe. A plain === leaks the secret one byte at a time.
	if ( ! hash_equals( (string) $record['hash'], hash( 'sha256', $secret ) ) ) {
		mc_auth_record_failure();
		return $deny();
	}

	$user = get_user_by( 'id', (int) $record['user_id'] );
	if ( ! $user ) {
		// The account behind the token is gone; the token must die with it.
		return $deny( 'mc_auth_orphaned', 401, 'The account this token belongs to no longer exists.' );
	}

	mc_auth_clear_failures();

	// Hand the request to WordPress as this user. From here on, every
	// current_user_can() check behaves exactly as it would in wp-admin.
	wp_set_current_user( $user->ID );

	// Touch the record so the operator can see whether a token is still in
	// use before revoking it. Rate-limited to one write a minute — the ROS
	// console is chatty, and a database write on every single request would
	// be a real cost for a field nobody reads to the second.
	$last = $record['last_used'] ? strtotime( $record['last_used'] ) : 0;
	if ( ( time() - $last ) > 60 ) {
		$tokens[ $id ]['last_used'] = current_time( 'c', true );
		$tokens[ $id ]['last_ip']   = mc_auth_client_ip();
		mc_auth_save_all( $tokens );
	}

	$record['id'] = $id;
	$resolved = $record;
	return $resolved;
}

/**
 * Permission callback factory. Pass the scope a route needs and the
 * capability WordPress should independently confirm.
 */
function mc_auth_require( $scope, $capability ) {
	return function () use ( $scope, $capability ) {
		$token = mc_auth_verify();
		if ( is_wp_error( $token ) ) {
			return $token;
		}
		if ( ! in_array( $scope, (array) $token['scopes'], true ) ) {
			return new WP_Error(
				'mc_auth_scope',
				sprintf( 'This token does not carry the "%s" scope.', $scope ),
				array( 'status' => 403 )
			);
		}
		if ( ! current_user_can( $capability ) ) {
			return new WP_Error(
				'mc_auth_capability',
				'The account behind this token lacks the required permission.',
				array( 'status' => 403 )
			);
		}
		return true;
	};
}

/* -------------------------------------------------------------------------
 * Introspection — lets ROS confirm a token works before relying on it.
 * ---------------------------------------------------------------------- */

add_action( 'rest_api_init', 'mc_auth_routes' );
function mc_auth_routes() {
	register_rest_route( 'mc/v1', '/token', array(
		'methods'             => 'GET',
		'callback'            => function () {
			$token = mc_auth_verify();
			if ( is_wp_error( $token ) ) {
				return $token;
			}
			$user = wp_get_current_user();
			return array(
				'ok'      => true,
				'label'   => $token['label'],
				'user'    => $user->user_login,
				'scopes'  => array_values( $token['scopes'] ),
				'created' => $token['created'],
				'can'     => array(
					'publish'  => current_user_can( 'edit_posts' ),
					'media'    => current_user_can( 'upload_files' ),
					'products' => current_user_can( 'edit_products' ) || current_user_can( 'edit_posts' ),
				),
			);
		},
		'permission_callback' => '__return_true', // verify() reports its own failure
	) );
}

/* -------------------------------------------------------------------------
 * Admin screen — Users → API Tokens
 * ---------------------------------------------------------------------- */

add_action( 'admin_menu', 'mc_auth_admin_menu' );
function mc_auth_admin_menu() {
	add_users_page(
		'Melting Cheese API Tokens',
		'API Tokens',
		'manage_options',
		'mc-api-tokens',
		'mc_auth_admin_page'
	);
}

function mc_auth_admin_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'You do not have permission to manage API tokens.' );
	}

	$issued = null;
	$notice = null;

	if ( ! empty( $_POST['mc_auth_action'] ) ) {
		check_admin_referer( 'mc_auth_manage' );

		if ( 'issue' === $_POST['mc_auth_action'] ) {
			$label  = isset( $_POST['label'] ) ? sanitize_text_field( wp_unslash( $_POST['label'] ) ) : '';
			$scopes = isset( $_POST['scopes'] ) ? array_map( 'sanitize_key', (array) $_POST['scopes'] ) : array();
			if ( '' === $label ) {
				$notice = 'Give the token a name so you can tell them apart later.';
			} else {
				$issued = mc_auth_issue( $label, get_current_user_id(), $scopes );
			}
		}

		if ( 'revoke' === $_POST['mc_auth_action'] && ! empty( $_POST['id'] ) ) {
			$notice = mc_auth_revoke( sanitize_text_field( wp_unslash( $_POST['id'] ) ) )
				? 'Token revoked. Any console still using it will stop working immediately.'
				: 'That token no longer exists.';
		}
	}

	$tokens = mc_auth_all();
	?>
	<div class="wrap">
		<h1>Melting Cheese API Tokens</h1>
		<p class="description" style="max-width:46em">
			These tokens let the ROS console publish app content, upload images and save
			products. A token acts as the WordPress user who created it, so it can never do
			more than that account can.
		</p>

		<?php if ( $notice ) : ?>
			<div class="notice notice-info"><p><?php echo esc_html( $notice ); ?></p></div>
		<?php endif; ?>

		<?php if ( $issued ) : ?>
			<div class="notice notice-success">
				<p><strong>Copy this now — it will not be shown again.</strong></p>
				<p>
					<input type="text" readonly onclick="this.select()" style="width:100%;max-width:44em;font-family:monospace;padding:8px"
					       value="<?php echo esc_attr( $issued['token'] ); ?>">
				</p>
				<p class="description">Paste it into the ROS console under Sync → App publishing.</p>
			</div>
		<?php endif; ?>

		<h2>Issue a token</h2>
		<form method="post">
			<?php wp_nonce_field( 'mc_auth_manage' ); ?>
			<input type="hidden" name="mc_auth_action" value="issue">
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="mc-label">Name</label></th>
					<td><input name="label" id="mc-label" type="text" class="regular-text" placeholder="ROS console" required></td>
				</tr>
				<tr>
					<th scope="row">Scopes</th>
					<td>
						<?php foreach ( mc_auth_scopes() as $key => $desc ) : ?>
							<label style="display:block;margin-bottom:4px">
								<input type="checkbox" name="scopes[]" value="<?php echo esc_attr( $key ); ?>" checked>
								<code><?php echo esc_html( $key ); ?></code> — <?php echo esc_html( $desc ); ?>
							</label>
						<?php endforeach; ?>
						<p class="description">Leave all three ticked for the ROS console.</p>
					</td>
				</tr>
			</table>
			<?php submit_button( 'Issue token' ); ?>
		</form>

		<h2>Existing tokens</h2>
		<?php if ( empty( $tokens ) ) : ?>
			<p>No tokens yet.</p>
		<?php else : ?>
			<table class="widefat striped">
				<thead><tr>
					<th>Name</th><th>Acts as</th><th>Scopes</th><th>Created</th><th>Last used</th><th></th>
				</tr></thead>
				<tbody>
				<?php foreach ( $tokens as $id => $t ) :
					$owner = get_user_by( 'id', (int) $t['user_id'] ); ?>
					<tr>
						<td><strong><?php echo esc_html( $t['label'] ); ?></strong></td>
						<td><?php echo esc_html( $owner ? $owner->user_login : 'deleted user' ); ?></td>
						<td><code><?php echo esc_html( implode( ', ', (array) $t['scopes'] ) ); ?></code></td>
						<td><?php echo esc_html( $t['created'] ); ?></td>
						<td><?php echo esc_html( $t['last_used'] ? $t['last_used'] . ' from ' . $t['last_ip'] : 'never' ); ?></td>
						<td>
							<form method="post" onsubmit="return confirm('Revoke this token? Anything using it stops working straight away.')">
								<?php wp_nonce_field( 'mc_auth_manage' ); ?>
								<input type="hidden" name="mc_auth_action" value="revoke">
								<input type="hidden" name="id" value="<?php echo esc_attr( $id ); ?>">
								<button class="button button-link-delete">Revoke</button>
							</form>
						</td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
		<?php endif; ?>
	</div>
	<?php
}
