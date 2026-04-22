import requests
from datetime import datetime, UTC
BASE = 'http://127.0.0.1:8000'
creds = {'username': 'admin_test', 'password': 'Teste@12345'}
res = requests.post(f'{BASE}/api/auth/login', data=creds)
res.raise_for_status()
token = res.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}
def revision():
    return requests.get(f'{BASE}/api/wms/meta', headers=headers).json().get('revision')
state = requests.get(f'{BASE}/api/wms/bootstrap', headers=headers).json()
print('initial revision', revision())
def attempt(endpoint, payload, label):
    try:
        resp = requests.put(f'{BASE}{endpoint}', headers=headers, json=payload)
        resp.raise_for_status()
        body = resp.json()
        print(f'{label} success ->', body.get('revision'))
        return body
    except requests.HTTPError as exc:
        print(f'{label} failed {resp.status_code}', resp.text)
        raise
structure_payload = {
    'expected_revision': revision(),
    'depots': state.get('state', {}).get('depots') or [],
    'activeDepotId': state.get('state', {}).get('activeDepotId'),
    'shelvesAll': state.get('state', {}).get('shelvesAll') or {},
}
structure_body = attempt('/api/wms/structure-state', structure_payload, 'structure')
inv_payload = {
    'expected_revision': revision(),
    'productsAll': state.get('state', {}).get('productsAll') or {},
    'history': state.get('state', {}).get('history') or [],
}
inv_body = attempt('/api/wms/inventory-state', inv_payload, 'inventory')
out_payload = {
    'expected_revision': revision(),
    'outboundRecords': state.get('state', {}).get('outboundRecords') or [],
}
out_body = attempt('/api/wms/outbound-records-state', out_payload, 'outbound')
unloads_payload = {
    'expected_revision': revision(),
    'blindCountRecords': state.get('state', {}).get('blindCountRecords') or [],
    'activeBlindUnloadId': state.get('state', {}).get('activeBlindUnloadId'),
}
unloads_body = attempt('/api/wms/unloads-state', unloads_payload, 'unloads')
print('all done at', datetime.now(UTC).isoformat())
