CREATE TABLE club_fees (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('membership','event')),
  category TEXT CHECK(category IN ('adult','cadet','junior','social','casual','lifetime')),
  event_id TEXT,
  title TEXT NOT NULL,
  price_cents INTEGER CHECK(price_cents IS NULL OR (typeof(price_cents)='integer' AND price_cents>=0)),
  active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
  version INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT, updated_at TEXT, last_mutation TEXT,
  CHECK((kind='membership' AND category IS NOT NULL AND event_id IS NULL) OR (kind='event' AND category IS NULL))
);
INSERT INTO club_fees(id,kind,category,title) VALUES
  ('membership-adult','membership','adult','Adult membership'),
  ('membership-cadet','membership','cadet','Cadet membership'),
  ('membership-junior','membership','junior','Junior membership'),
  ('membership-social','membership','social','Social membership'),
  ('membership-casual','membership','casual','Casual membership'),
  ('membership-lifetime','membership','lifetime','Lifetime membership');

CREATE TABLE club_fee_mutations (
  mutation TEXT PRIMARY KEY, actor_id TEXT NOT NULL, request_key TEXT NOT NULL,
  fee_id TEXT NOT NULL REFERENCES club_fees(id), saved_version INTEGER NOT NULL
);
-- A failing precondition aborts the complete D1 batch. Successful saves insert no guard rows.
CREATE TABLE club_fee_write_checks (ok INTEGER NOT NULL CONSTRAINT fee_batch_version CHECK(ok=1));
CREATE TABLE officer_price_changes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL, item_id TEXT NOT NULL, title TEXT NOT NULL,
  old_cents INTEGER, new_cents INTEGER, actor_id TEXT NOT NULL, actor_login TEXT NOT NULL, changed_at TEXT NOT NULL
);
CREATE TABLE officer_price_recipients (
  seq INTEGER NOT NULL REFERENCES officer_price_changes(seq),
  recipient TEXT NOT NULL, read_at TEXT,
  PRIMARY KEY(seq,recipient)
);
CREATE INDEX officer_price_inbox ON officer_price_recipients(recipient,seq DESC);
CREATE INDEX officer_price_unread ON officer_price_recipients(recipient) WHERE read_at IS NULL;

CREATE TRIGGER club_fee_initial_price AFTER INSERT ON club_fees WHEN NEW.active=1 AND NEW.price_cents IS NOT NULL BEGIN
  INSERT INTO officer_price_changes(kind,item_id,title,old_cents,new_cents,actor_id,actor_login,changed_at)
    VALUES(NEW.kind,NEW.id,NEW.title,NULL,NEW.price_cents,NEW.updated_by,
           COALESCE((SELECT login FROM club_accounts WHERE id=NEW.updated_by),'Club officer'),NEW.updated_at);
END;
CREATE TRIGGER club_fee_changed_price AFTER UPDATE OF price_cents,active ON club_fees
WHEN (CASE WHEN OLD.active=1 THEN OLD.price_cents END) IS NOT (CASE WHEN NEW.active=1 THEN NEW.price_cents END) BEGIN
  INSERT INTO officer_price_changes(kind,item_id,title,old_cents,new_cents,actor_id,actor_login,changed_at)
    VALUES(NEW.kind,NEW.id,NEW.title,CASE WHEN OLD.active=1 THEN OLD.price_cents END,
           CASE WHEN NEW.active=1 THEN NEW.price_cents END,NEW.updated_by,
           COALESCE((SELECT login FROM club_accounts WHERE id=NEW.updated_by),'Club officer'),NEW.updated_at);
END;
CREATE TRIGGER merch_initial_price AFTER INSERT ON merch_shop_offers WHEN NEW.price_cents IS NOT NULL BEGIN
  INSERT INTO officer_price_changes(kind,item_id,title,old_cents,new_cents,actor_id,actor_login,changed_at)
    SELECT 'merchandise',NEW.product_id,p.name,NULL,NEW.price_cents,NEW.updated_by,
           COALESCE((SELECT login FROM club_accounts WHERE id=NEW.updated_by),'Club officer'),NEW.updated_at
    FROM merch_products p WHERE p.id=NEW.product_id;
END;
CREATE TRIGGER merch_changed_price AFTER UPDATE OF price_cents ON merch_shop_offers WHEN OLD.price_cents IS NOT NEW.price_cents BEGIN
  INSERT INTO officer_price_changes(kind,item_id,title,old_cents,new_cents,actor_id,actor_login,changed_at)
    SELECT 'merchandise',NEW.product_id,p.name,OLD.price_cents,NEW.price_cents,NEW.updated_by,
           COALESCE((SELECT login FROM club_accounts WHERE id=NEW.updated_by),'Club officer'),NEW.updated_at
    FROM merch_products p WHERE p.id=NEW.product_id;
END;
CREATE TRIGGER officer_price_fanout AFTER INSERT ON officer_price_changes BEGIN
  INSERT INTO officer_price_recipients(seq,recipient,read_at)
    SELECT NEW.seq,'account:'||id,NEW.changed_at FROM club_accounts WHERE id=NEW.actor_id AND disabled=0 AND role IN ('committee','treasurer','administrator');
  INSERT INTO officer_price_recipients(seq,recipient)
    SELECT NEW.seq,'account:'||id FROM club_accounts
    WHERE disabled=0 AND role IN ('committee','treasurer','administrator') AND id<>NEW.actor_id;
  INSERT INTO officer_price_recipients(seq,recipient)
    SELECT NEW.seq,'invite:'||i.digest FROM club_invites i
    WHERE i.role IN ('committee','treasurer','administrator') AND i.reset_id IS NULL
    AND i.used_by IS NULL AND i.expires>CAST(strftime('%s','now') AS INTEGER)
    AND NOT EXISTS(SELECT 1 FROM club_accounts a WHERE a.login=i.login);
END;
CREATE TRIGGER officer_price_activate AFTER INSERT ON club_accounts WHEN NEW.role IN ('committee','treasurer','administrator') BEGIN
  UPDATE officer_price_recipients SET recipient='account:'||NEW.id
    WHERE recipient IN (SELECT 'invite:'||digest FROM club_invites
      WHERE used_by=NEW.id AND reset_id IS NULL AND role=NEW.role AND (login IS NULL OR login=NEW.login));
END;
