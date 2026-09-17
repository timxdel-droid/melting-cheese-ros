<?php
/**
 * Plugin Name: Melting Cheese — App Config
 * Description: Serves the ROS-controlled home layout and banner packs to the iOS and Android apps, and accepts published changes from the Retail Operations System.
 * Version:     1.0.0
 * Author:      Melting Cheese
 *
 * Drop this file in wp-content/mu-plugins/ — must-use plugins load automatically,
 * so the theme's functions.php is left untouched and a theme update cannot remove it.
 *
 * Endpoints
 *   GET  /wp-json/mc/v1/app-config   public, cached, ETag + 304
 *   POST /wp-json/mc/v1/app-config   requires a WordPress Application Password
 *
 * The apps must treat every field as optional. If this endpoint is unreachable
 * they keep rendering their built-in layout, so a bad publish can never leave a
 * customer staring at an empty home screen.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const MC_APP_CONFIG_OPTION   = 'mc_app_config';
const MC_APP_CONFIG_MAX_BYTES = 262144; // 256 KB — a layout that exceeds this is a bug, not a layout.

/**
 * How far above the recorded build a self-reporting app may push latest_build
 * in one step.
 *
 * The app-config route is public, so this is the only thing stopping someone
 * curling a header at it and claiming build 99999 — which would leave every
 * real app permanently offering an update to something that does not exist.
 * Builds go up by one at a time, so this is already far more slack than a real
 * release needs. min_build is never touched by a report, so even a successful
 * lie cannot lock anybody out of the app.
 */
const MC_APP_CONFIG_MAX_BUILD_JUMP = 25;

/**
 * Shared hosting on Apache/CGI strips the Authorization header before PHP sees
 * it, which makes Application Passwords fail with a confusing "not logged in"
 * error. Restore it here — mu-plugins load before authentication is determined.
 */
add_action( 'plugins_loaded', 'mc_app_config_restore_auth_header', 1 );
function mc_app_config_restore_auth_header() {
	if ( ! empty( $_SERVER['HTTP_AUTHORIZATION'] ) ) {
		return;
	}
	if ( ! empty( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) {
		$_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
		return;
	}
	if ( function_exists( 'getallheaders' ) ) {
		foreach ( getallheaders() as $name => $value ) {
			if ( 'authorization' === strtolower( $name ) ) {
				$_SERVER['HTTP_AUTHORIZATION'] = $value;
				return;
			}
		}
	}
}

/* -------------------------------------------------------------------------
 * CORS — the ROS console is served from a different host than WordPress.
 * ---------------------------------------------------------------------- */

function mc_app_config_allowed_origins() {
	return array(
		'https://dev.meltingcheese.food',
		'https://ros.meltingcheeseez.com',
		'http://localhost:5173',
	);
}

add_filter( 'rest_pre_serve_request', 'mc_app_config_cors_headers', 5, 4 );
function mc_app_config_cors_headers( $served, $result, $request, $server ) {
	if ( strpos( $request->get_route(), '/mc/v1/' ) !== 0 ) {
		return $served;
	}
	$origin = get_http_origin();
	if ( $origin && in_array( $origin, mc_app_config_allowed_origins(), true ) ) {
		header( 'Access-Control-Allow-Origin: ' . $origin );
		header( 'Vary: Origin' );
	}
	header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS' );
	header( 'Access-Control-Allow-Headers: Authorization, Content-Type, If-None-Match, X-MC-Token' );
	header( 'Access-Control-Expose-Headers: ETag' );
	return $served;
}

/* -------------------------------------------------------------------------
 * Routes
 * ---------------------------------------------------------------------- */

add_action( 'rest_api_init', 'mc_app_config_routes' );
function mc_app_config_routes() {

	register_rest_route( 'mc/v1', '/app-config', array(
		array(
			'methods'             => 'GET',
			'callback'            => 'mc_app_config_get',
			'permission_callback' => '__return_true',
		),
		array(
			'methods'             => 'POST',
			'callback'            => 'mc_app_config_post',
			'permission_callback' => 'mc_app_config_can_publish',
		),
	) );

	// Build servers call this when a build ships, so "latest build" is a
	// fact reported by the pipeline rather than a number someone typed.
	register_rest_route( 'mc/v1', '/releases/report', array(
		'methods'             => 'POST',
		'callback'            => 'mc_app_config_report_release',
		'permission_callback' => 'mc_app_config_can_publish',
	) );

	// Lets the ROS console confirm a credential works before the operator
	// publishes anything, instead of finding out mid-save.
	register_rest_route( 'mc/v1', '/whoami', array(
		'methods'             => 'GET',
		'callback'            => function () {
			// Resolve a token first so this reports the same identity the
			// publish route would use, rather than "not authenticated" for a
			// caller whose token is perfectly valid.
			$token = null;
			if ( function_exists( 'mc_auth_presented_token' ) && '' !== mc_auth_presented_token() ) {
				$verified = mc_auth_verify();
				$token    = is_wp_error( $verified ) ? null : $verified;
			}
			$user = wp_get_current_user();
			return array(
				'authenticated' => (bool) $user->ID,
				'user'          => $user->ID ? $user->user_login : null,
				'can_publish'   => current_user_can( 'edit_posts' ),
				'method'        => $token ? 'token' : ( $user->ID ? 'application-password' : null ),
				'token_label'   => $token ? $token['label'] : null,
				'scopes'        => $token ? array_values( $token['scopes'] ) : null,
			);
		},
		'permission_callback' => '__return_true',
	) );
}

function mc_app_config_can_publish() {

	// Preferred path: our own token in X-MC-Token. mc_auth_require() sets the
	// current user on success, so the capability check below is unchanged.
	if ( function_exists( 'mc_auth_presented_token' ) && '' !== mc_auth_presented_token() ) {
		$gate = mc_auth_require( 'publish', 'edit_posts' );
		return $gate();
	}

	// Fallback: a WordPress Application Password over Basic auth. Kept so an
	// existing credential keeps working and so there is a way in if the token
	// plugin is ever disabled.
	if ( ! is_user_logged_in() ) {
		return new WP_Error(
			'mc_not_authenticated',
			'Send an X-MC-Token header, or a WordPress Application Password using Basic authentication.',
			array( 'status' => 401 )
		);
	}
	if ( ! current_user_can( 'edit_posts' ) ) {
		return new WP_Error(
			'mc_forbidden',
			'This account cannot publish app content.',
			array( 'status' => 403 )
		);
	}
	return true;
}

/* -------------------------------------------------------------------------
 * Read
 * ---------------------------------------------------------------------- */

function mc_app_config_default() {
	return array(
		'version'    => 0,
		'updated_at' => null,
		'updated_by' => null,
		'events'     => array(),
		'banners'    => array(),
		'app'        => mc_app_config_default_releases(),
		'fleet'      => array(),
	);
}

/**
 * A release block that gates nothing.
 *
 * min_build 0 means "every build is acceptable". This is the shape returned
 * when nothing has been published, and it matters: if a missing block were
 * ever read as a high minimum, a fresh install would brick itself on launch.
 */
function mc_app_config_default_releases() {
	$blank = array(
		'min_build'    => 0,
		'latest_build' => 0,
		'version_name' => '',
		'apk_url'      => '',
		'sha256'       => '',
		'notes'        => '',
	);
	return array( 'android' => $blank, 'ios' => $blank );
}

function mc_app_config_get( WP_REST_Request $request ) {
	// Every launch of every app hits this route and each request carries the
	// build it came from, so the console can show the real number without
	// anyone typing it and without the pipeline holding a token.
	mc_app_config_note_calling_build( $request );

	$config = get_option( MC_APP_CONFIG_OPTION );
	if ( ! is_array( $config ) ) {
		$config = mc_app_config_default();
	}

	// Configs published before release gating existed have no 'app' key.
	// Fill it in on read so clients can rely on the field being present
	// rather than each app having to guess what a missing block means.
	if ( empty( $config['app'] ) || ! is_array( $config['app'] ) ) {
		$config['app'] = mc_app_config_default_releases();
	}
	if ( ! isset( $config['fleet'] ) || ! is_array( $config['fleet'] ) ) {
		$config['fleet'] = array();
	}

	$body = wp_json_encode( $config );
	$etag = '"' . md5( $body ) . '"';

	$response = new WP_REST_Response( $config, 200 );
	$response->header( 'ETag', $etag );
	$response->header( 'Cache-Control', 'public, max-age=60, stale-while-revalidate=600' );

	$sent = $request->get_header( 'if_none_match' );
	if ( $sent && trim( $sent ) === $etag ) {
		$response->set_status( 304 );
		$response->set_data( null );
	}

	return $response;
}

/* -------------------------------------------------------------------------
 * Write
 * ---------------------------------------------------------------------- */

function mc_app_config_post( WP_REST_Request $request ) {
	$incoming = $request->get_json_params();

	if ( ! is_array( $incoming ) ) {
		return new WP_Error( 'mc_bad_payload', 'Send a JSON object.', array( 'status' => 400 ) );
	}
	if ( strlen( (string) $request->get_body() ) > MC_APP_CONFIG_MAX_BYTES ) {
		return new WP_Error( 'mc_payload_too_large', 'Config exceeds 256 KB.', array( 'status' => 413 ) );
	}
	if ( empty( $incoming['events'] ) || ! is_array( $incoming['events'] ) ) {
		return new WP_Error(
			'mc_no_events',
			'Refusing to publish a config with no events — the apps would have nothing to show.',
			array( 'status' => 422 )
		);
	}

	$existing = get_option( MC_APP_CONFIG_OPTION );
	$previous = is_array( $existing ) ? $existing : mc_app_config_default();

	$user = wp_get_current_user();

	$config = array(
		'version'       => (int) $previous['version'] + 1,
		'updated_at'    => current_time( 'c', true ),
		'updated_by'    => $user->user_login,
		'default_event' => isset( $incoming['default_event'] ) ? sanitize_key( $incoming['default_event'] ) : null,
		'events'        => mc_app_config_clean_events( $incoming['events'] ),
		'banners'       => mc_app_config_clean_banners( isset( $incoming['banners'] ) ? $incoming['banners'] : array() ),
		'app'           => mc_app_config_clean_releases(
			isset( $incoming['app'] ) ? $incoming['app'] : array(),
			isset( $previous['app'] ) && is_array( $previous['app'] ) ? $previous['app'] : array()
		),
		'fleet'         => mc_app_config_clean_fleet( isset( $incoming['fleet'] ) ? $incoming['fleet'] : array() ),
	);

	// A minimum above the newest available build would lock every customer out
	// of the app with no way back in. Refuse rather than sanitise silently.
	foreach ( $config['app'] as $platform => $rel ) {
		if ( $rel['min_build'] > 0 && $rel['latest_build'] > 0 && $rel['min_build'] > $rel['latest_build'] ) {
			return new WP_Error(
				'mc_impossible_min_build',
				sprintf(
					'Refusing to publish: %s requires build %d but the newest build on offer is %d, which would lock every user out.',
					$platform,
					$rel['min_build'],
					$rel['latest_build']
				),
				array( 'status' => 422 )
			);
		}
	}

	// Keep one generation back so a bad publish can be rolled back without a backup.
	update_option( MC_APP_CONFIG_OPTION . '_previous', $previous, false );
	update_option( MC_APP_CONFIG_OPTION, $config, true );

	return new WP_REST_Response( array(
		'ok'         => true,
		'version'    => $config['version'],
		'updated_at' => $config['updated_at'],
		'updated_by' => $config['updated_by'],
		'events'     => count( $config['events'] ),
		'banners'    => count( $config['banners'] ),
	), 200 );
}

/**
 * Notices the build number an app sent with its config request.
 *
 *   X-MC-App-Platform: ios
 *   X-MC-App-Build: 23
 *   X-MC-App-Version: 1.1.0
 *
 * Absent or unparseable headers mean this does nothing at all, which is the
 * case for the console, curl, and every older build of both apps.
 */
function mc_app_config_note_calling_build( WP_REST_Request $request ) {
	$platform = sanitize_key( (string) $request->get_header( 'x_mc_app_platform' ) );
	if ( ! in_array( $platform, array( 'ios', 'android' ), true ) ) {
		return;
	}

	$build = (int) $request->get_header( 'x_mc_app_build' );
	if ( $build <= 0 ) {
		return;
	}

	mc_app_config_record_build(
		$platform,
		$build,
		(string) $request->get_header( 'x_mc_app_version' ),
		'app',
		MC_APP_CONFIG_MAX_BUILD_JUMP
	);
}

/**
 * Writes a build number into a platform's release block.
 *
 * Shared by the pipeline route and by apps reporting themselves so the two
 * paths cannot drift apart. Returns the resulting latest_build.
 *
 * It never lowers the number: a re-run of an old commit, or a tester still on
 * last week's build, must not make everyone else think the newest build went
 * away. That also means the common case — an app reporting the build already
 * on record — writes nothing, so the hot path stays a plain read.
 *
 * $max_jump of 0 means no ceiling, which is right for the authenticated
 * pipeline; an untrusted caller passes a real limit.
 */
function mc_app_config_record_build( $platform, $build, $version_name = '', $source = 'pipeline', $max_jump = 0 ) {
	$existing = get_option( MC_APP_CONFIG_OPTION );
	$config   = is_array( $existing ) ? $existing : mc_app_config_default();
	if ( empty( $config['app'] ) || ! is_array( $config['app'] ) ) {
		$config['app'] = mc_app_config_default_releases();
	}

	$rel     = $config['app'][ $platform ];
	$current = (int) ( isset( $rel['latest_build'] ) ? $rel['latest_build'] : 0 );

	if ( $build <= $current ) {
		return $current;
	}
	if ( $max_jump > 0 && $build > $current + $max_jump ) {
		return $current;
	}

	$rel['latest_build'] = $build;
	if ( '' !== trim( (string) $version_name ) ) {
		$rel['version_name'] = sanitize_text_field( $version_name );
	}
	$rel['reported_at']   = current_time( 'c', true );
	$rel['reported_from'] = sanitize_key( $source );

	$config['app'][ $platform ] = $rel;
	$config['version']    = (int) ( isset( $config['version'] ) ? $config['version'] : 0 ) + 1;
	$config['updated_at'] = current_time( 'c', true );

	$user = wp_get_current_user();
	$config['updated_by'] = $user && $user->user_login ? $user->user_login : sanitize_key( $source );

	update_option( MC_APP_CONFIG_OPTION, $config, true );

	return $build;
}

/**
 * POST /mc/v1/releases/report — called by the build pipeline.
 *
 *   { "platform": "ios", "build": 23, "version_name": "1.1.0", "source": "codemagic" }
 *
 * Records the build that actually shipped as that platform's latest_build,
 * touching nothing else in the config. It never lowers the number: a re-run
 * of an old commit must not make the apps think the newest build went away.
 * The whole config is what the apps read, so a successful report is a new
 * config version and their next launch sees it.
 */
function mc_app_config_report_release( WP_REST_Request $request ) {
	$in = $request->get_json_params();
	if ( ! is_array( $in ) ) {
		return new WP_Error( 'mc_bad_payload', 'Send a JSON object.', array( 'status' => 400 ) );
	}

	$platform = isset( $in['platform'] ) ? sanitize_key( $in['platform'] ) : '';
	if ( ! in_array( $platform, array( 'ios', 'android' ), true ) ) {
		return new WP_Error( 'mc_bad_platform', 'platform must be "ios" or "android".', array( 'status' => 422 ) );
	}
	$build = isset( $in['build'] ) ? (int) $in['build'] : 0;
	if ( $build <= 0 ) {
		return new WP_Error( 'mc_bad_build', 'build must be a positive integer.', array( 'status' => 422 ) );
	}

	// The pipeline is authenticated and is stating a fact about an upload that
	// already happened, so no ceiling applies to it.
	$latest = mc_app_config_record_build(
		$platform,
		$build,
		isset( $in['version_name'] ) ? $in['version_name'] : '',
		! empty( $in['source'] ) ? $in['source'] : 'pipeline',
		0
	);

	$config = get_option( MC_APP_CONFIG_OPTION );
	$rel    = isset( $config['app'][ $platform ] ) ? $config['app'][ $platform ] : array();

	return new WP_REST_Response( array(
		'ok'           => true,
		'ignored'      => $latest !== $build,
		'platform'     => $platform,
		'latest_build' => $latest,
		'version_name' => isset( $rel['version_name'] ) ? $rel['version_name'] : '',
		'version'      => isset( $config['version'] ) ? (int) $config['version'] : 0,
	), 200 );
}

function mc_app_config_clean_events( $events ) {
	$out = array();
	foreach ( (array) $events as $event ) {
		if ( empty( $event['id'] ) ) {
			continue;
		}
		$layout     = isset( $event['layout'] ) && is_array( $event['layout'] ) ? $event['layout'] : array();
		$categories = array();

		foreach ( (array) ( isset( $layout['categories'] ) ? $layout['categories'] : array() ) as $i => $cat ) {
			if ( empty( $cat['name'] ) ) {
				continue;
			}
			$categories[] = array(
				'slug'    => isset( $cat['slug'] ) ? sanitize_title( $cat['slug'] ) : sanitize_title( $cat['name'] ),
				'name'    => sanitize_text_field( $cat['name'] ),
				'visible' => ! empty( $cat['visible'] ),
				'order'   => (int) $i,
			);
		}

		$out[] = array(
			'id'     => sanitize_key( $event['id'] ),
			'name'   => isset( $event['name'] ) ? sanitize_text_field( $event['name'] ) : '',
			// Where the event physically is, shown in the app's location picker.
			'venue'  => isset( $event['venue'] ) ? sanitize_text_field( $event['venue'] ) : '',
			'layout' => array(
				'header_pack' => isset( $layout['header_pack'] ) ? sanitize_key( $layout['header_pack'] ) : null,
				'categories'  => $categories,
				'mid'         => mc_app_config_clean_slot( isset( $layout['mid'] ) ? $layout['mid'] : null ),
				'video'       => mc_app_config_clean_slot( isset( $layout['video'] ) ? $layout['video'] : null ),
			),
		);
	}
	return $out;
}

/**
 * The truck fleet, and which events each truck is deployed to.
 *
 * This lived only in the ROS browser's localStorage until now, which meant
 * the server could not put a truck on an order, and a second laptop showed an
 * empty fleet. Publishing it makes the fleet a fact about the business rather
 * than a fact about one browser.
 *
 * Deliberately not published: the equipment checklist. That is a packing aid
 * for whoever loads the truck, and nothing outside ROS has any use for it.
 */
function mc_app_config_clean_fleet( $incoming ) {
	$out = array();

	foreach ( (array) $incoming as $truck ) {
		if ( empty( $truck['id'] ) ) {
			continue;
		}

		$events = array();
		foreach ( (array) ( isset( $truck['events'] ) ? $truck['events'] : array() ) as $event_id ) {
			$key = sanitize_key( $event_id );
			if ( $key ) {
				$events[] = $key;
			}
		}

		$out[] = array(
			'id'     => sanitize_key( $truck['id'] ),
			'name'   => isset( $truck['name'] ) ? sanitize_text_field( $truck['name'] ) : '',
			'plate'  => isset( $truck['plate'] ) ? sanitize_text_field( $truck['plate'] ) : '',
			'events' => array_values( array_unique( $events ) ),
		);
	}

	return $out;
}

/**
 * Release gating, per platform.
 *
 * The app treats min_build as "refuse to run below this" and latest_build as
 * "offer an update above this", so both are clamped to sane integers. The APK
 * URL is HTTPS-only: an installer fetched over plain HTTP can be swapped in
 * transit, and the whole point of the checksum is to make that pointless.
 */
function mc_app_config_clean_releases( $incoming, $previous = array() ) {
	$out = mc_app_config_default_releases();

	foreach ( array( 'android', 'ios' ) as $platform ) {
		$prev = isset( $previous[ $platform ] ) && is_array( $previous[ $platform ] ) ? $previous[ $platform ] : array();

		if ( empty( $incoming[ $platform ] ) || ! is_array( $incoming[ $platform ] ) ) {
			// Nothing sent for this platform: keep what the pipeline reported
			// rather than resetting it to zero.
			if ( ! empty( $prev['reported_at'] ) ) {
				$out[ $platform ] = $prev;
			}
			continue;
		}
		$src = $incoming[ $platform ];

		$url = isset( $src['apk_url'] ) ? esc_url_raw( trim( (string) $src['apk_url'] ), array( 'https' ) ) : '';

		// A checksum is 64 hex characters or it is not a checksum. Anything
		// else is dropped, so a typo becomes "no checksum" rather than a
		// value the app would compare against and always fail.
		$sha = isset( $src['sha256'] ) ? strtolower( trim( (string) $src['sha256'] ) ) : '';
		if ( ! preg_match( '/^[a-f0-9]{64}$/', $sha ) ) {
			$sha = '';
		}

		$latest = max( 0, (int) ( isset( $src['latest_build'] ) ? $src['latest_build'] : 0 ) );

		// A build reported by the pipeline is a fact; a console publish can
		// carry it forward but not talk it down. The console may still
		// raise it by hand (e.g. a build shipped while reporting was off).
		$reported = ! empty( $prev['reported_at'] ) ? (int) $prev['latest_build'] : 0;
		if ( $reported > $latest ) {
			$latest = $reported;
		}

		$out[ $platform ] = array(
			'min_build'    => max( 0, (int) ( isset( $src['min_build'] ) ? $src['min_build'] : 0 ) ),
			'latest_build' => $latest,
			'version_name' => isset( $src['version_name'] ) ? sanitize_text_field( $src['version_name'] ) : '',
			'apk_url'      => $url ? $url : '',
			'sha256'       => $sha,
			'notes'        => isset( $src['notes'] ) ? sanitize_textarea_field( $src['notes'] ) : '',
		);
		if ( $reported > 0 ) {
			$out[ $platform ]['reported_at']   = $prev['reported_at'];
			$out[ $platform ]['reported_from'] = isset( $prev['reported_from'] ) ? $prev['reported_from'] : 'pipeline';
		}
	}

	return $out;
}

function mc_app_config_clean_slot( $slot ) {
	if ( ! is_array( $slot ) || empty( $slot['pack_id'] ) ) {
		return null;
	}
	return array(
		'pack_id' => sanitize_key( $slot['pack_id'] ),
		'after'   => isset( $slot['after'] ) ? max( 0, (int) $slot['after'] ) : 0,
	);
}

function mc_app_config_clean_banners( $banners ) {
	$allowed_status  = array( 'live', 'scheduled', 'draft' );
	$allowed_variant = array( 'cta', 'plain', 'image' );
	$out = array();

	foreach ( (array) $banners as $pack ) {
		if ( empty( $pack['id'] ) ) {
			continue;
		}

		$variants = array();
		foreach ( $allowed_variant as $key ) {
			$src = isset( $pack['variants'][ $key ] ) && is_array( $pack['variants'][ $key ] ) ? $pack['variants'][ $key ] : array();
			$variants[ $key ] = array(
				'image_url' => ! empty( $src['image_url'] ) ? esc_url_raw( $src['image_url'] ) : null,
			);
		}

		$status = isset( $pack['status'] ) ? strtolower( (string) $pack['status'] ) : 'draft';
		if ( ! in_array( $status, $allowed_status, true ) ) {
			$status = 'draft';
		}

		$out[] = array(
			'id'        => sanitize_key( $pack['id'] ),
			'name'      => isset( $pack['name'] ) ? sanitize_text_field( $pack['name'] ) : '',
			'headline'  => isset( $pack['headline'] ) ? sanitize_text_field( $pack['headline'] ) : '',
			'cta'       => isset( $pack['cta'] ) ? sanitize_text_field( $pack['cta'] ) : '',
			'deep_link' => isset( $pack['deep_link'] ) ? esc_url_raw( $pack['deep_link'], array( 'http', 'https', 'app' ) ) : '',
			'audience'  => isset( $pack['audience'] ) ? sanitize_text_field( $pack['audience'] ) : '',
			'status'    => $status,
			'variants'  => $variants,
		);
	}
	return $out;
}
