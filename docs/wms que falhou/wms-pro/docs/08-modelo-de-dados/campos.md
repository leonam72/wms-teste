# Campos

## Objetivo

Registrar os campos principais identificados para cada entidade.

## Escopo

Inclui apenas campos explicitamente listados no inventário.

## Conteúdo

- `users`
  - `id`, `username`, `full_name`, `password_hash`, `role`, `is_active`, `parent_user_id`, `last_login_at`
- `depots`
  - `id`, `name`, `address`, `city`, `manager`, `phone`, `notes`, `allow_overcapacity`
- `shelves`
  - `id`, `depot_id`, `code`, `shelf_type`, `floors`, `drawers_per_floor`, `max_kg_per_drawer`
- `drawers`
  - `id`, `shelf_id`, `floor_number`, `drawer_number`, `drawer_key`
- `products`
  - `id`, `code`, `name`, `sku`, `ean`, `category`, `supplier`, `unit`, `brand`, `manufacturer`, `model`, `ncm`, `anvisa`, `temp_min`, `temp_max`, `min_stock`, `max_stock`, `reorder_point`, `length_cm`, `width_cm`, `height_cm`, `is_perishable`, `serial_control`, `expiry_control`, `notes`
- `stock_items`
  - `id`, `product_id`, `drawer_id`, `quantity`, `kg`, `kg_per_unit`, `lot`, `entry_date`, `notes`
- `expiries`
  - `id`, `stock_item_id`, `date_value`
- `inventory_movements`
  - `id`, `action`, `icon`, `detail`, `happened_at`, `user_id`, `username`, `depot_id`, `drawer_key`, `product_code`, `payload_json`
- `stock_quality_states`
  - `stock_item_id`, `depot_id`, `shelf_id`, `drawer_id`, `drawer_key`, `product_code`, `shelf_type`, `nearest_expiry`, `expiry_status`, `days_to_expiry`, `days_overdue`, `has_expiry`, `is_quarantine`, `is_blocked`, `computed_at`
- `quality_summaries`
  - `scope_type`, `scope_id`, `label`, `expired_count`, `expiring_count`, `quarantine_count`, `blocked_count`, `short_expiry_count`, `overdue_total_days`, `computed_at`
- `floorplan_shelves`
  - `depot_id`, `shelf_id`, `x`, `y`, `rotation`
- `floorplan_objects`
  - `depot_id`, `obj_type`, `x`, `y`, `w`, `h`, `text`, `style_class`
- `audit_logs`
  - `user_id`, `username`, `action`, `table_name`, `record_id`, `old_value`, `new_value`, `ip_address`, `created_at_event`
- `sync_state`
  - `last_pulled_at`, `last_pushed_at`, `version`
- `wms_state_snapshots`
  - `snapshot_key`, `revision`, `state_json`, `source`, `notes`
- `sync_queue`
  - `entity_type`, `entity_id`, `operation`, `payload`, `status`, `retry_count`, `last_error`
- `blind_count_pool_items`
  - `unload_id`, `item_key`, `payload_json`
- `login_attempts`
  - `bucket_key`, `attempted_at`
- `alembic_version`
  - `version_num`

## Lacunas

- Tipos de dados SQL, nulabilidade e valores default exatos não foram identificados no código atual.
