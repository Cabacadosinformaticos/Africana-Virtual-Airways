<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

cors_headers();
$method   = $_SERVER['REQUEST_METHOD'];
$path     = api_path('/api/fleet');
$segments = $path ? explode('/', $path) : [];
$id       = $segments[0] ?? null;

// GET /api/fleet
if ($method === 'GET' && !$id) {
    $clauses = []; $vals = [];
    if (!empty($_GET['hub']))      { $clauses[] = 'hub=?';                  $vals[] = strtoupper($_GET['hub']); }
    if (!empty($_GET['category'])) { $clauses[] = 'LOWER(category)=LOWER(?)'; $vals[] = $_GET['category']; }
    $where = $clauses ? 'WHERE ' . implode(' AND ', $clauses) : '';
    $stmt  = db()->prepare("SELECT * FROM aircraft {$where} ORDER BY id ASC");
    $stmt->execute($vals);
    json_ok(array_map('map_aircraft', $stmt->fetchAll()));
}

// GET /api/fleet/{id}
if ($method === 'GET' && $id) {
    $stmt = db()->prepare("SELECT * FROM aircraft WHERE id=? OR registration=? LIMIT 1");
    $stmt->execute([(int)$id, $id]);
    $a = $stmt->fetch();
    if (!$a) json_err('Aircraft not found', 404);
    json_ok(map_aircraft($a));
}

// POST /api/fleet
if ($method === 'POST' && !$id) {
    require_admin();
    $d    = req_body();
    $stmt = db()->prepare("INSERT INTO aircraft (registration,type,category,hub,hub_name,economy_seats,business_seats,first_seats,range_km,cruise_speed_kmh,status,image,description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
    $stmt->execute([$d['registration'],$d['type'],$d['category'],$d['hub'],$d['hub_name'],
        $d['seats']['economy']??0,$d['seats']['business']??0,$d['seats']['first']??0,
        $d['range_km']??0,$d['cruise_speed_kmh']??0,$d['status']??'active',$d['image']??null,$d['description']??null]);
    $newId = (int)db()->lastInsertId();
    $stmt  = db()->prepare("SELECT * FROM aircraft WHERE id=? LIMIT 1"); $stmt->execute([$newId]);
    json_ok(map_aircraft($stmt->fetch()), 201);
}

// PUT /api/fleet/{id}
if ($method === 'PUT' && $id) {
    require_admin();
    $existing = db()->prepare("SELECT * FROM aircraft WHERE id=? OR registration=? LIMIT 1");
    $existing->execute([(int)$id, $id]);
    $a = $existing->fetch();
    if (!$a) json_err('Aircraft not found', 404);

    $d    = array_merge($a, req_body());
    $stmt = db()->prepare("UPDATE aircraft SET registration=?,type=?,category=?,hub=?,hub_name=?,economy_seats=?,business_seats=?,first_seats=?,range_km=?,cruise_speed_kmh=?,status=?,image=?,description=? WHERE id=?");
    $stmt->execute([$d['registration'],$d['type'],$d['category'],$d['hub'],$d['hub_name'],
        $d['seats']['economy']??$d['economy_seats']??0,$d['seats']['business']??$d['business_seats']??0,$d['seats']['first']??$d['first_seats']??0,
        $d['range_km']??0,$d['cruise_speed_kmh']??0,$d['status']??'active',$d['image']??null,$d['description']??null,$a['id']]);
    $stmt = db()->prepare("SELECT * FROM aircraft WHERE id=? LIMIT 1"); $stmt->execute([$a['id']]);
    json_ok(map_aircraft($stmt->fetch()));
}

// DELETE /api/fleet/{id}
if ($method === 'DELETE' && $id) {
    require_admin();
    $stmt = db()->prepare("SELECT * FROM aircraft WHERE id=? OR registration=? LIMIT 1");
    $stmt->execute([(int)$id, $id]);
    $a = $stmt->fetch();
    if (!$a) json_err('Aircraft not found', 404);
    db()->prepare("UPDATE aircraft SET status='retired' WHERE id=?")->execute([$a['id']]);
    json_ok(['message' => 'Aircraft retired']);
}

json_err('Not found', 404);
