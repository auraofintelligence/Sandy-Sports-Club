-- Sample catalogue items only. The Treasurer confirms the actual range,
-- counts and prices before taking orders. No historical stock is imported.
INSERT INTO merch_products (id, name, public_note, display_order) VALUES
  ('shirt', 'Sample club shirt', 'Example merchandise. Design, availability and price are to be confirmed by the Treasurer.', 1),
  ('cooler', 'Sample stubby cooler', 'Example merchandise. Availability and price are to be confirmed by the Treasurer.', 2),
  ('sticker', 'Sample club sticker', 'Example merchandise. Availability and price are to be confirmed by the Treasurer.', 3);

INSERT INTO merch_stock_items (id, product_id, label) VALUES
  ('shirt-member', 'shirt', 'Sample shirt'),
  ('cooler', 'cooler', 'Sample stubby cooler'),
  ('sticker', 'sticker', 'Sample sticker');
