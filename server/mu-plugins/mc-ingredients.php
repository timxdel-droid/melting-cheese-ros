<?php
/**
 * Plugin Name: Melting Cheese — Product Ingredients
 * Description: Stores per-product ingredients and exposes them on the public WooCommerce Store API so the iOS and Android apps can read them without credentials.
 * Version:     1.0.0
 * Author:      Melting Cheese
 *
 * Why this file exists
 * --------------------
 * The apps read /wp-json/wc/store/v1/products, which is public and needs no
 * keys. That endpoint deliberately does not return meta_data, so ingredients
 * saved as ordinary product meta would be invisible to both apps.
 *
 * WooCommerce provides a supported way to add fields to that response:
 * ExtendSchema. Ingredients therefore arrive inside each product as
 *
 *   "extensions": { "melting_cheese": { "ingredients": [ ... ] } }
 *
 * Writes still happen through the normal wc/v3 products endpoint using the
 * store's consumer key, so the ROS console needs no new credential.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const MC_INGREDIENTS_META = '_mc_ingredients';

/* -------------------------------------------------------------------------
 * Storage — registered on the product post type so wc/v3 can read and write
 * it, which is what the ROS Product Editor uses.
 * ---------------------------------------------------------------------- */

add_action( 'init', 'mc_ingredients_register_meta' );
function mc_ingredients_register_meta() {
	register_post_meta( 'product', MC_INGREDIENTS_META, array(
		'type'          => 'array',
		'description'   => 'Ordered ingredient list shown on the product screen in the apps.',
		'single'        => true,
		'show_in_rest'  => array(
			'schema' => array(
				'type'  => 'array',
				'items' => array(
					'type'       => 'object',
					'properties' => array(
						'name'     => array( 'type' => 'string' ),
						'quantity' => array( 'type' => 'string' ),
						'unit'     => array( 'type' => 'string' ),
					),
				),
			),
		),
		'auth_callback' => function () {
			return current_user_can( 'edit_products' );
		},
	) );
}

/**
 * Reads the stored list and normalises it.
 *
 * Anything malformed is dropped rather than passed through — a broken
 * ingredient row must not be able to break the product screen in the apps.
 */
function mc_ingredients_for_product( $product_id ) {
	$raw = get_post_meta( $product_id, MC_INGREDIENTS_META, true );

	// wc/v3 clients sometimes send the array JSON-encoded as a string.
	if ( is_string( $raw ) && '' !== $raw ) {
		$decoded = json_decode( $raw, true );
		$raw     = is_array( $decoded ) ? $decoded : array();
	}
	if ( ! is_array( $raw ) ) {
		return array();
	}

	$out = array();
	foreach ( $raw as $row ) {
		if ( ! is_array( $row ) || empty( $row['name'] ) ) {
			continue;
		}
		$out[] = array(
			'name'     => sanitize_text_field( $row['name'] ),
			'quantity' => isset( $row['quantity'] ) ? sanitize_text_field( (string) $row['quantity'] ) : '',
			'unit'     => isset( $row['unit'] ) ? sanitize_text_field( (string) $row['unit'] ) : '',
		);
	}
	return $out;
}

/* -------------------------------------------------------------------------
 * Store API — the public feed both apps already read.
 * ---------------------------------------------------------------------- */

add_action( 'woocommerce_blocks_loaded', 'mc_ingredients_extend_store_api' );
function mc_ingredients_extend_store_api() {

	if ( ! function_exists( 'woocommerce_store_api_register_endpoint_data' ) ) {
		return; // WooCommerce too old for the supported extension API.
	}

	woocommerce_store_api_register_endpoint_data( array(
		'endpoint'        => \Automattic\WooCommerce\StoreApi\Schemas\V1\ProductSchema::IDENTIFIER,
		'namespace'       => 'melting_cheese',
		'data_callback'   => function ( $product ) {
			return array(
				'ingredients' => mc_ingredients_for_product( $product->get_id() ),
			);
		},
		'schema_callback' => function () {
			return array(
				'ingredients' => array(
					'description' => 'Ordered ingredient list for this product.',
					'type'        => 'array',
					'readonly'    => true,
					'items'       => array(
						'type'       => 'object',
						'properties' => array(
							'name'     => array( 'type' => 'string' ),
							'quantity' => array( 'type' => 'string' ),
							'unit'     => array( 'type' => 'string' ),
						),
					),
				),
			);
		},
		'schema_type'     => ARRAY_A,
	) );
}

/* -------------------------------------------------------------------------
 * wc/v3 — lets the ROS Product Editor read and write the list directly on
 * the product, instead of needing a bespoke endpoint.
 * ---------------------------------------------------------------------- */

add_action( 'rest_api_init', 'mc_ingredients_register_v3_field' );
function mc_ingredients_register_v3_field() {
	register_rest_field( 'product', 'mc_ingredients', array(
		'get_callback'    => function ( $product ) {
			return mc_ingredients_for_product( $product['id'] );
		},
		'update_callback' => function ( $value, $product ) {
			if ( ! is_array( $value ) ) {
				return;
			}
			$clean = array();
			foreach ( $value as $row ) {
				if ( ! is_array( $row ) || empty( $row['name'] ) ) {
					continue;
				}
				$clean[] = array(
					'name'     => sanitize_text_field( $row['name'] ),
					'quantity' => isset( $row['quantity'] ) ? sanitize_text_field( (string) $row['quantity'] ) : '',
					'unit'     => isset( $row['unit'] ) ? sanitize_text_field( (string) $row['unit'] ) : '',
				);
			}
			update_post_meta( $product->get_id(), MC_INGREDIENTS_META, $clean );
		},
		'schema'          => array(
			'description' => 'Ordered ingredient list for this product.',
			'type'        => 'array',
			'context'     => array( 'view', 'edit' ),
		),
	) );
}

/* -------------------------------------------------------------------------
 * The Store API is aggressively cached. Without this, an ingredient edit can
 * sit invisible behind a stale cache long after the operator saved it.
 * ---------------------------------------------------------------------- */

add_action( 'updated_post_meta', 'mc_ingredients_bust_cache', 10, 3 );
add_action( 'added_post_meta', 'mc_ingredients_bust_cache', 10, 3 );
function mc_ingredients_bust_cache( $meta_id, $post_id, $meta_key ) {
	if ( MC_INGREDIENTS_META !== $meta_key ) {
		return;
	}
	if ( function_exists( 'wc_delete_product_transients' ) ) {
		wc_delete_product_transients( $post_id );
	}
	clean_post_cache( $post_id );
}
