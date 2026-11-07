import math

RS = "\x1e"
MAX_POINTS_PER_FEATURE = 20


def iter_geojsonseq(path):
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip(RS + "\n")
            if line:
                yield line


def ring_area_m2(ring):
    if len(ring) < 3:
        return 0.0
    lat0 = sum(p[1] for p in ring) / len(ring)
    m_per_deg_lat = 111_320.0
    m_per_deg_lon = 111_320.0 * math.cos(math.radians(lat0))
    xs = [p[0] * m_per_deg_lon for p in ring]
    ys = [p[1] * m_per_deg_lat for p in ring]
    area = 0.0
    n = len(xs)
    for i in range(n):
        j = (i + 1) % n
        area += xs[i] * ys[j] - xs[j] * ys[i]
    return abs(area) / 2.0


def centroid(points):
    lon = sum(p[0] for p in points) / len(points)
    lat = sum(p[1] for p in points) / len(points)
    return [round(lat, 5), round(lon, 5)]


def subsample(points, max_points=MAX_POINTS_PER_FEATURE):
    if len(points) <= max_points:
        return points
    step = (len(points) - 1) / (max_points - 1)
    out = []
    for i in range(max_points):
        out.append(points[round(i * step)])
    return out


def points_as_latlon(coords, max_points=MAX_POINTS_PER_FEATURE):
    sampled = subsample(coords, max_points)
    return [[round(p[1], 5), round(p[0], 5)] for p in sampled]
