-- OrderFlow Seed Data
USE orderflow;

-- Sample products
INSERT INTO products (name, description, price, stock) VALUES
  ('Laptop Pro 15', 'Laptop de 15 pulgadas con 16GB RAM', 1499.99, 10),
  ('Mouse Inalámbrico', 'Mouse ergonómico inalámbrico', 29.99, 50),
  ('Teclado Mecánico', 'Teclado mecánico RGB', 89.99, 30),
  ('Monitor 27" 4K', 'Monitor UHD 27 pulgadas', 399.99, 15),
  ('Auriculares Bluetooth', 'Auriculares con cancelación de ruido', 199.99, 25),
  ('Webcam HD 1080p', 'Cámara web Full HD', 79.99, 20),
  ('Hub USB-C 7 en 1', 'Hub multipuerto USB-C', 49.99, 40),
  ('Silla Ergonómica', 'Silla de oficina ergonómica', 459.99, 5);
