def _decode_polyline6(polyline: str) -> list[list[float]]:
    points = []
    index = 0
    lat = 0
    lng = 0
    length = len(polyline)
    while index < length:
        b = 0; shift = 0; result = 0
        while True:
            b = ord(polyline[index]) - 63; index += 1; result |= (b & 0x1F) << shift; shift += 5
            if b < 0x20: break
        dlat = ~(result >> 1) if (result & 1) else (result >> 1); lat += dlat
        
        shift = 0; result = 0
        while True:
            b = ord(polyline[index]) - 63; index += 1; result |= (b & 0x1F) << shift; shift += 5
            if b < 0x20: break
        dlng = ~(result >> 1) if (result & 1) else (result >> 1); lng += dlng
        
        points.append([lng / 1E6, lat / 1E6])
    return points

# Let's decode a simple point
print(_decode_polyline6("o|v|vA?")) # ? means 0 in some cases, let's see.
