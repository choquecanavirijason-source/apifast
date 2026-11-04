-- Additive only. Run by schema.py under a transaction and advisory lock.
CREATE TABLE public.retouch_reminders (
    event_key VARCHAR(64) NOT NULL,
    broadcast_id INTEGER NOT NULL,
    preview_version VARCHAR(64) NOT NULL,
    CONSTRAINT retouch_reminders_pkey PRIMARY KEY (event_key),
    CONSTRAINT retouch_reminders_broadcast_id_key UNIQUE (broadcast_id),
    CONSTRAINT retouch_reminders_broadcast_id_fkey FOREIGN KEY (broadcast_id)
        REFERENCES public.broadcasts(id)
);
COMMENT ON TABLE public.retouch_reminders IS 'E-Lashes retouch reminder receipt v1; preserve on application rollback';
