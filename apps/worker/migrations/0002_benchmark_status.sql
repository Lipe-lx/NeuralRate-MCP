ALTER TABLE decisions ADD COLUMN benchmark_status TEXT DEFAULT 'local';
ALTER TABLE decisions ADD COLUMN onchain_decision_id TEXT;

UPDATE decisions
SET benchmark_status = CASE
  WHEN tx_hash IS NOT NULL AND TRIM(tx_hash) <> '' THEN 'onchain'
  ELSE 'local'
END
WHERE benchmark_status IS NULL OR TRIM(benchmark_status) = '';
