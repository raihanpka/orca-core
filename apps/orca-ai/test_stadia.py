import httpx
payload = {
    "locations": [{"lat": -6.283, "lon": 106.820, "type": "break"}, {"lat": -6.148, "lon": 106.889, "type": "break"}],
    "costing": "auto"
}
response = httpx.post("https://api.stadiamaps.com/route/v1", json=payload)
data = response.json()
shape = data["trip"]["legs"][0]["shape"]
print(f"Shape: {shape[:20]}...")

def decode(polyline):
    points = []; index = 0; lat = 0; lng = 0; length = len(polyline)
    while index < length:
        b = 0; shift = 0; result = 0
        while True:
            b = ord(polyline[index]) - 63; index += 1; result |= (b & 0x1F) << shift; shift += 5
            if b < 0x20: break
        lat += ~(result >> 1) if (result & 1) else (result >> 1)
        
        shift = 0; result = 0
        while True:
            b = ord(polyline[index]) - 63; index += 1; result |= (b & 0x1F) << shift; shift += 5
            if b < 0x20: break
        lng += ~(result >> 1) if (result & 1) else (result >> 1)
        points.append([lng / 1E6, lat / 1E6])
    return points

points = decode(shape)
print("Start decoded:", points[0])
print("End decoded:", points[-1])
