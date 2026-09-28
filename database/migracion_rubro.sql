-- Agrega el rubro a los proveedores (Semillas, Combustibles, etc.).
-- Hay que ejecutarlo una vez en la base de datos (db_asi) antes de usar el rubro.
ALTER TABLE proveedor ADD COLUMN rubro VARCHAR(80) NULL AFTER descripcion;
