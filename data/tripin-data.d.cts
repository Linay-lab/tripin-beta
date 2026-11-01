declare namespace TripinData {
  const APP_DATA_KEY: 'travel_studio_beta_v3';
  const GPS_LEDGER_KEY: 'travel-studio-gps-ledger-v1';
  type CloudEntity = 'trips' | 'saved_collections' | 'shopping_items' | 'itinerary_stops' | 'trip_expenses' | 'trip_budgets' | 'shopping_places' | 'trip_info';
  interface Trip { id: string; name?: string; country?: string; city?: string; start?: string; end?: string; notes?: string; budget: number; cover?: string; coverX?: number; coverY?: number; coverZoom?: number }
  interface Item { id: string; name?: string; type?: string; country?: string; city?: string; place?: string; currency?: string; recipient?: string; category?: string; note?: string; trip?: string; shoppingPlaceId?: string; price: number; qty: number; bought: boolean; image?: string; source?: string }
  interface Plan { id: string; trip?: string; name?: string; date?: string; time?: string; place?: string; note?: string }
  interface Expense { id: string; trip?: string; name?: string; currency?: string; payer?: string; date?: string; amount: number }
  interface Info { id: string; trip?: string; type?: string; name?: string; value?: string; note?: string }
  interface ShoppingPlace { id: string; name: string; lat: number; lng: number }
  interface LocalData { trips: Trip[]; items: Item[]; plans: Plan[]; expenses: Expense[]; info: Info[]; shoppingPlaces?: ShoppingPlace[]; shoppingReminderRadius?: 100 | 200 | 500 | 1000 }
  interface StorageAdapter { getItem(key: string): string | null; setItem(key: string, value: string): void }
  type FailureCode = 'STORAGE_READ' | 'STORAGE_WRITE' | 'CORRUPT' | 'STALE' | 'INVALID' | 'INVALID_EXPECTATION';
  type SaveResult = {ok: true; raw: string} | {ok: false; code: FailureCode};
  type LoadResult = {ok: true; raw: string | null; data: LocalData} | {ok: false; code: 'STORAGE_READ' | 'CORRUPT'; raw: string | null; data: LocalData};
  interface LocalRepository {
    load(fallback: LocalData): LoadResult;
    save(data: unknown, expectedRaw: string | null, options?: {blocked?: boolean}): SaveResult;
    parseBackup(text: string): LocalData;
    exportBackup(data: LocalData, options?: {blocked?: boolean; raw?: string | null}): string;
  }
  function normalizeBackup(input: unknown): LocalData;
  function safeImage(input: unknown): string;
  function safeUrl(input: unknown): string;
  function createLocalRepository(storage: StorageAdapter, key?: string): LocalRepository;
  function createJsonRecordStore(storage: StorageAdapter, key: typeof GPS_LEDGER_KEY): Readonly<{read(): unknown; write(value: unknown): void}>;
  function createCloudIdResolver(maps: Partial<Record<CloudEntity, Record<string, string>>>): (entity: CloudEntity, localId: string) => string;
  function shoppingItemDraft(input: Item, options: {resolveId: (entity: CloudEntity, localId: string) => string; userId: string}): {
    row: {id: string; trip_id: string; created_by: string; name: string; quantity: number; recipient: string; category: string; price: number; currency: string; place_name: string | null; note: string | null; bought: boolean};
    pending: {type: string; country: string; city: string; source: string; image: string; shoppingPlaceId: string};
  };
}
export = TripinData;
