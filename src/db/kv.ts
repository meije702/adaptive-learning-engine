let _kv: Deno.Kv | null = null;

export async function getKv(): Promise<Deno.Kv> {
  if (!_kv) {
    _kv = await Deno.openKv();
  }
  return _kv;
}

export async function closeKv(): Promise<void> {
  if (_kv) {
    _kv.close();
    _kv = null;
  }
}
