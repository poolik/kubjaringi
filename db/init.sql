CREATE TYPE mode AS ENUM ('HEAT', 'COLD', 'FAN');
CREATE TABLE remote (temperature integer, mode mode, isave boolean);
INSERT INTO remote VALUES (21, 'HEAT', false);