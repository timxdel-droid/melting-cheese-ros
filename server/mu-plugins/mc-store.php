<?php
/**
 * Plugin Name: Melting Cheese — Console Store API
 * Description: Media upload and product read/save endpoints for the ROS console, authenticated by an X-MC-Token instead of WordPress Application Passwords or WooCommerce consumer keys.
 * Version:     1.0.0
 * Author:      Melting Cheese
 *
 * Requires mc-auth.php.
 *
 * Why these exist rather than using wp/v2 and wc/v3
 * -------------------------------------------------
 * Those endpoints work, but each wants its own credential: an Application
 * Password for media, a consumer key and secret for products. Wrapping them
 * here means the console holds one token.
 *
 * These wrappers do not widen anything. mc_auth_require() has already called
 * wp_set_current_user(), so every WordPress function called below performs
 * its normal capability check against a real account. If that account cannot
 * upload a file, neither can this endpoint.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const MC_STORE_MAX_UPLOAD = 8388608; // 8 MB — a menu photo has no business being larger.

/** Only these land in the media library. Checked against real file contents. */
function mc_store_allowed_image_types() {
	return array(
		'jpg|jpeg|jpe' => 'image/jpeg',
		'png'          => 'image/png',
		'webp'         => 'image/webp',
	);
}

add_action( 'rest_api_init', 'mc_store_routes' );
function mc_store_routes() {

	if ( ! function_exists( 'mc_auth_require' ) ) {
		return; // mc-auth.php missing — fail closed rather than register open routes.
	}

	register_rest_route( 'mc/v1', '/media', array(
		'methods'             => 'POST',
		'callback'            => 'mc_store_upload',
		'permission_callback' => mc_auth_require( 'media', 'upload_files' ),
	) );

	register_rest_route( 'mc/v1', '/release-apk', array(
		'methods'             => 'POST',
		'callback'            => 'mc_store_upload_apk',
		'permission_callback' => mc_auth_require( 'media', 'upload_files' ),
	) );

	register_rest_route( 'mc/v1', '/products', array(
		'methods'             => 'GET',
		'callback'            => 'mc_store_list_products',
		'permission_callback' => mc_auth_require( 'products', 'edit_products' ),
		'args'                => array(
			'search'   => array( 'type' => 'string' ),
			'per_page' => array( 'type' => 'integer', 'default' => 50 ),
			'page'     => array( 'type' => 'integer', 'default' => 1 ),
		),
	) );

	register_rest_route( 'mc/v1', '/products/(?P<id>\d+)', array(
		array(
			'methods'             => 'GET',
			'callback'            => 'mc_store_get_product',
			'permission_callback' => mc_auth_require( 'products', 'edit_products' ),
		),
		array(
			'methods'             => 'POST',
			'callback'            => 'mc_store_save_product',
			'permission_callback' => mc_auth_require( 'products', 'edit_products' ),
		),
	) );

	register_rest_route( 'mc/v1', '/product-categories', array(
		'methods'             => 'GET',
		'callback'            => function () {
			$terms = get_terms( array( 'taxonomy' => 'product_cat', 'hide_empty' => false ) );
			if ( is_wp_error( $terms ) ) {
				return $terms;
			}
			return array_map( function ( $t ) {
				return array( 'id' => $t->term_id, 'name' => $t->name, 'slug' => $t->slug, 'count' => $t->count );
			}, $terms );
		},
		'permission_callback' => mc_auth_require( 'products', 'edit_products' ),
	) );
}

/* -------------------------------------------------------------------------
 * Media
 * ---------------------------------------------------------------------- */

function mc_store_upload( WP_REST_Request $request ) {
	$files = $request->get_file_params();
	if ( empty( $files['file'] ) ) {
		return new WP_Error( 'mc_no_file', 'Send the image as multipart form-data under "file".', array( 'status' => 400 ) );
	}

	$file = $files['file'];

	if ( ! empty( $file['error'] ) ) {
		return new WP_Error( 'mc_upload_error', 'The upload did not complete.', array( 'status' => 400 ) );
	}
	if ( (int) $file['size'] > MC_STORE_MAX_UPLOAD ) {
		return new WP_Error( 'mc_too_large', 'Images must be 8 MB or smaller.', array( 'status' => 413 ) );
	}

	// Trust the file, not the filename. A .jpg containing PHP is the classic
	// way this goes wrong, so the extension must match the real contents.
	$check = wp_check_filetype_and_ext( $file['tmp_name'], $file['name'], mc_store_allowed_image_types() );
	if ( empty( $check['ext'] ) || empty( $check['type'] ) ) {
		return new WP_Error( 'mc_bad_type', 'Only JPEG, PNG and WebP images are accepted.', array( 'status' => 415 ) );
	}
	$sniffed = @getimagesize( $file['tmp_name'] );
	if ( false === $sniffed ) {
		return new WP_Error( 'mc_not_image', 'That file is not a readable image.', array( 'status' => 415 ) );
	}

	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';

	// Force the extension WordPress derived from the contents, ignoring
	// whatever the client claimed.
	$file['name'] = preg_replace( '/\.[^.]+$/', '', sanitize_file_name( $file['name'] ) ) . '.' . $check['ext'];

	$attachment_id = media_handle_sideload(
		array( 'name' => $file['name'], 'tmp_name' => $file['tmp_name'] ),
		0,
		$request->get_param( 'title' ) ? sanitize_text_field( $request->get_param( 'title' ) ) : null
	);

	if ( is_wp_error( $attachment_id ) ) {
		return $attachment_id;
	}

	$alt = $request->get_param( 'alt' );
	if ( $alt ) {
		update_post_meta( $attachment_id, '_wp_attachment_image_alt', sanitize_text_field( $alt ) );
	}

	return array(
		'id'         => (int) $attachment_id,
		'source_url' => wp_get_attachment_url( $attachment_id ),
		'thumbnail'  => wp_get_attachment_image_url( $attachment_id, 'thumbnail' ),
		'mime'       => get_post_mime_type( $attachment_id ),
	);
}

/* -------------------------------------------------------------------------
 * Release binaries
 *
 * APKs deliberately do NOT go through the media library. WordPress excludes
 * .apk from its mime allowlist, and working around that would mean widening
 * uploads site-wide for every user and every form — a large hole opened for
 * a small convenience. Instead they land in their own directory with PHP
 * execution switched off, and are served as plain static files.
 * ---------------------------------------------------------------------- */

const MC_STORE_APK_DIR       = 'mc-releases';
const MC_STORE_MAX_APK_BYTES = 209715200; // 200 MB

function mc_store_release_dir() {
	$uploads = wp_upload_dir();
	$path    = trailingslashit( $uploads['basedir'] ) . MC_STORE_APK_DIR;
	$url     = trailingslashit( $uploads['baseurl'] ) . MC_STORE_APK_DIR;

	if ( ! file_exists( $path ) ) {
		wp_mkdir_p( $path );
	}

	// Belt and braces. The directory holds attacker-supplied bytes by
	// definition, so make sure the server will never execute anything in it
	// even if something other than an APK ends up here.
	$htaccess = $path . '/.htaccess';
	if ( ! file_exists( $htaccess ) ) {
		file_put_contents(
			$htaccess,
			"php_flag engine off\n" .
			"<FilesMatch \"\\.(php|phtml|php[0-9])$\">\n  Require all denied\n</FilesMatch>\n"
		);
	}

	return array( 'path' => $path, 'url' => $url );
}

function mc_store_upload_apk( WP_REST_Request $request ) {
	$files = $request->get_file_params();
	if ( empty( $files['file'] ) ) {
		return new WP_Error( 'mc_no_file', 'Send the APK as multipart form-data under "file".', array( 'status' => 400 ) );
	}

	$file = $files['file'];
	if ( ! empty( $file['error'] ) ) {
		return new WP_Error( 'mc_upload_error', 'The upload did not complete.', array( 'status' => 400 ) );
	}
	if ( (int) $file['size'] > MC_STORE_MAX_APK_BYTES ) {
		return new WP_Error( 'mc_too_large', 'That file is larger than 200 MB.', array( 'status' => 413 ) );
	}

	// Prove it is actually an Android package rather than something renamed.
	// An APK is a zip archive that contains AndroidManifest.xml; checking the
	// archive contents is far stronger than trusting the extension.
	if ( ! class_exists( 'ZipArchive' ) ) {
		return new WP_Error( 'mc_no_zip', 'The server cannot inspect archives, so the upload was refused.', array( 'status' => 501 ) );
	}
	$zip = new ZipArchive();
	if ( true !== $zip->open( $file['tmp_name'] ) ) {
		return new WP_Error( 'mc_not_apk', 'That file is not a readable APK.', array( 'status' => 415 ) );
	}
	$has_manifest = false !== $zip->locateName( 'AndroidManifest.xml' );
	$zip->close();
	if ( ! $has_manifest ) {
		return new WP_Error( 'mc_not_apk', 'That archive contains no AndroidManifest.xml, so it is not an APK.', array( 'status' => 415 ) );
	}

	$build = max( 0, (int) $request->get_param( 'build' ) );
	$name  = $build ? "melting-cheese-{$build}.apk" : 'melting-cheese-' . time() . '.apk';

	$dir  = mc_store_release_dir();
	$dest = $dir['path'] . '/' . $name;

	if ( ! @move_uploaded_file( $file['tmp_name'], $dest ) ) {
		// REST uploads are not always true uploaded files depending on how the
		// request was routed, so fall back to a plain copy.
		if ( ! @copy( $file['tmp_name'], $dest ) ) {
			return new WP_Error( 'mc_write_failed', 'The file could not be saved on the server.', array( 'status' => 500 ) );
		}
	}
	@chmod( $dest, 0644 );

	// Hashed here, not in the browser. This describes the bytes that actually
	// reached disk, which is the thing the app will download and verify.
	$sha = hash_file( 'sha256', $dest );

	return array(
		'url'    => $dir['url'] . '/' . $name,
		'sha256' => $sha,
		'size'   => filesize( $dest ),
		'name'   => $name,
	);
}

/* -------------------------------------------------------------------------
 * Products
 * ---------------------------------------------------------------------- */

function mc_store_product_payload( $product ) {
	$images = array();
	$ids    = array_merge( array( $product->get_image_id() ), $product->get_gallery_image_ids() );
	// array_values matters: array_filter preserves keys, so a product with no
	// main image would start at index 1 and nothing would be flagged as main.
	foreach ( array_values( array_filter( $ids ) ) as $i => $id ) {
		$images[] = array(
			'id'   => (int) $id,
			'src'  => wp_get_attachment_url( $id ),
			'alt'  => get_post_meta( $id, '_wp_attachment_image_alt', true ),
			'main' => 0 === $i,
		);
	}

	return array(
		'id'                => $product->get_id(),
		'name'              => $product->get_name(),
		'slug'              => $product->get_slug(),
		'status'            => $product->get_status(),
		'description'       => $product->get_description(),
		'short_description' => $product->get_short_description(),
		'regular_price'     => $product->get_regular_price(),
		'sale_price'        => $product->get_sale_price(),
		'sku'               => $product->get_sku(),
		'categories'        => array_values( array_filter( array_map( function ( $id ) {
			$t = get_term( $id, 'product_cat' );
			return $t && ! is_wp_error( $t ) ? array( 'id' => $t->term_id, 'name' => $t->name ) : null;
		}, $product->get_category_ids() ) ) ),
		'images'            => $images,
		// The Store API strips meta_data, which is why ingredients live behind
		// their own helper rather than being read straight off the product.
		'ingredients'       => function_exists( 'mc_ingredients_for_product' )
			? mc_ingredients_for_product( $product->get_id() )
			: array(),
	);
}

function mc_store_list_products( WP_REST_Request $request ) {
	if ( ! function_exists( 'wc_get_products' ) ) {
		return new WP_Error( 'mc_no_woo', 'WooCommerce is not active.', array( 'status' => 503 ) );
	}

	$products = wc_get_products( array(
		'status'   => array( 'publish', 'draft', 'private' ),
		'limit'    => min( 100, max( 1, (int) $request->get_param( 'per_page' ) ) ),
		'page'     => max( 1, (int) $request->get_param( 'page' ) ),
		's'        => $request->get_param( 'search' ) ? sanitize_text_field( $request->get_param( 'search' ) ) : '',
		'orderby'  => 'title',
		'order'    => 'ASC',
	) );

	return array_map( 'mc_store_product_payload', $products );
}

function mc_store_get_product( WP_REST_Request $request ) {
	$product = wc_get_product( (int) $request['id'] );
	if ( ! $product ) {
		return new WP_Error( 'mc_not_found', 'No product with that id.', array( 'status' => 404 ) );
	}
	return mc_store_product_payload( $product );
}

function mc_store_save_product( WP_REST_Request $request ) {
	$id      = (int) $request['id'];
	$product = wc_get_product( $id );
	if ( ! $product ) {
		return new WP_Error( 'mc_not_found', 'No product with that id.', array( 'status' => 404 ) );
	}

	// Per-object check. edit_products is a blanket capability; this confirms
	// the account may edit THIS post, honouring any role plugin in play.
	if ( ! current_user_can( 'edit_post', $id ) ) {
		return new WP_Error( 'mc_forbidden', 'You cannot edit that product.', array( 'status' => 403 ) );
	}

	$body = $request->get_json_params();
	if ( ! is_array( $body ) ) {
		return new WP_Error( 'mc_bad_payload', 'Send a JSON object.', array( 'status' => 400 ) );
	}

	if ( isset( $body['name'] ) ) {
		$product->set_name( sanitize_text_field( $body['name'] ) );
	}
	if ( isset( $body['description'] ) ) {
		$product->set_description( wp_kses_post( $body['description'] ) );
	}
	if ( isset( $body['short_description'] ) ) {
		$product->set_short_description( wp_kses_post( $body['short_description'] ) );
	}
	if ( isset( $body['sku'] ) ) {
		// Duplicate SKUs throw, which would surface as a 500. Catch and report.
		try {
			$product->set_sku( sanitize_text_field( $body['sku'] ) );
		} catch ( Exception $e ) {
			return new WP_Error( 'mc_bad_sku', 'That SKU is already in use.', array( 'status' => 409 ) );
		}
	}
	if ( isset( $body['regular_price'] ) ) {
		$product->set_regular_price( wc_format_decimal( $body['regular_price'] ) );
	}
	if ( array_key_exists( 'sale_price', $body ) ) {
		$product->set_sale_price( '' === $body['sale_price'] ? '' : wc_format_decimal( $body['sale_price'] ) );
	}
	if ( isset( $body['categories'] ) && is_array( $body['categories'] ) ) {
		$product->set_category_ids( array_values( array_filter( array_map( 'intval', $body['categories'] ) ) ) );
	}

	// Images arrive as attachment ids the console already uploaded via
	// /mc/v1/media. First is the main image, the rest become the gallery.
	if ( isset( $body['images'] ) && is_array( $body['images'] ) ) {
		$ids = array();
		foreach ( $body['images'] as $img ) {
			$att = is_array( $img ) ? ( isset( $img['id'] ) ? (int) $img['id'] : 0 ) : (int) $img;
			// Refuse ids that are not real attachments — otherwise a typo
			// silently points the product at an arbitrary post.
			if ( $att && 'attachment' === get_post_type( $att ) ) {
				$ids[] = $att;
			}
		}
		$product->set_image_id( $ids ? array_shift( $ids ) : '' );
		$product->set_gallery_image_ids( $ids );
	}

	$product->save();

	if ( isset( $body['ingredients'] ) && is_array( $body['ingredients'] ) && defined( 'MC_INGREDIENTS_META' ) ) {
		$clean = array();
		foreach ( $body['ingredients'] as $row ) {
			if ( ! is_array( $row ) || empty( $row['name'] ) ) {
				continue;
			}
			$clean[] = array(
				'name'     => sanitize_text_field( $row['name'] ),
				'quantity' => isset( $row['quantity'] ) ? sanitize_text_field( (string) $row['quantity'] ) : '',
				'unit'     => isset( $row['unit'] ) ? sanitize_text_field( (string) $row['unit'] ) : '',
			);
		}
		update_post_meta( $id, MC_INGREDIENTS_META, $clean );
	}

	// The Store API caches hard; without this the apps keep serving the old
	// copy long after the operator saw a success message.
	if ( function_exists( 'wc_delete_product_transients' ) ) {
		wc_delete_product_transients( $id );
	}
	clean_post_cache( $id );

	return mc_store_product_payload( wc_get_product( $id ) );
}
