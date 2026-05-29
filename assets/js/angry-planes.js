/**
 * Africana Airways — Angry Planes
 * Slingshot a plane into towers topped with professor silhouettes.
 * Drag the plane back on the sling, release to launch.
 */

(function () {
  const canvas = document.getElementById('angryCanvas');
  const ctx    = canvas.getContext('2d');
  const W = 860, H = 460;
  canvas.width  = W;
  canvas.height = H;

  const GROUND_Y   = H - 50;
  const GRAVITY    = 0.28;
  const SLING_X    = 110;
  const SLING_Y    = GROUND_Y - 55;
  const MAX_PULL   = 80;
  const LAUNCH_PWR = 0.2;

  const STATE = { IDLE: 0, AIMING: 1, FLYING: 2, LEVEL_CLEAR: 3, GAME_OVER: 4 };
  let state = STATE.IDLE;

  let score      = 0;
  let level      = 1;
  let planesLeft = 3;
  let frame      = 0;
  let resetTimer = 0;

  // Projectile
  let plane = { x: SLING_X, y: SLING_Y, vx: 0, vy: 0, active: false };

  // Drag
  let isDragging = false;
  let dragX = SLING_X, dragY = SLING_Y;

  // Towers
  let towers = [];

  // Score DOM
  const elScore = document.getElementById('apScore');
  const elBest  = document.getElementById('apBest');
  let bestScore = parseInt(localStorage.getItem('afv_ap_best') || '0', 10);
  if (elBest) elBest.textContent = bestScore;

  // Stars
  const STARS = Array.from({ length: 55 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H * 0.55,
    r: Math.random() * 1.3 + 0.3,
    a: Math.random() * 0.5 + 0.25
  }));

  // Plane image
  const planeImg = new Image();
  planeImg.src = 'assets/img/plane.png';

  // ── Helpers ──────────────────────────────────────────────────────

  function seededRand(seed, i) {
    const x = Math.sin(seed + i) * 43758.5453;
    return x - Math.floor(x);
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ── Game state management ─────────────────────────────────────────

  function buildTowers() {
    towers = [];
    const count   = Math.min(2 + level, 6);
    const startX  = 420;
    const span    = W - startX - 80;
    const spacing = span / count;
    for (let i = 0; i < count; i++) {
      const tW      = 50 + (seededRand(level * 7, i) * 22 | 0);
      const tH      = 70 + (seededRand(level * 13, i) * 110 | 0);
      const health  = Math.ceil(level / 2);
      towers.push({
        x: startX + i * spacing + spacing / 2 - tW / 2,
        y: GROUND_Y - tH,
        w: tW, h: tH,
        health, maxHealth: health,
        seed:      (seededRand(level, i) * 1000) | 0,
        shakeTimer: 0,
        fallAngle:  0,
        falling:    false,
        destroyed:  false
      });
    }
  }

  function planesForLevel() {
    // Always enough to clear if reasonably accurate, but not trivially easy
    return Math.max(3, Math.ceil(towers.length * 0.65));
  }

  function resetGame() {
    score      = 0;
    level      = 1;
    frame      = 0;
    resetTimer = 0;
    resetPlane();
    buildTowers();
    planesLeft = planesForLevel();
    if (elScore) elScore.textContent = '0';
  }

  function resetPlane() {
    plane      = { x: SLING_X, y: SLING_Y, vx: 0, vy: 0, active: false, hitSet: new Set() };
    isDragging = false;
    dragX      = SLING_X;
    dragY      = SLING_Y;
  }

  function nextLevel() {
    level++;
    resetTimer = 0;
    resetPlane();
    buildTowers();
    planesLeft = planesForLevel();
  }

  // ── Drawing ───────────────────────────────────────────────────────

  function drawBackground() {
    // Warm sunset sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0,    '#1a0a2e');
    sky.addColorStop(0.35, '#3d1560');
    sky.addColorStop(0.65, '#b84020');
    sky.addColorStop(0.85, '#e06530');
    sky.addColorStop(1,    '#f08040');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Stars (only visible in dark upper sky)
    STARS.forEach(s => {
      ctx.globalAlpha = s.a * (0.5 + 0.5 * Math.sin(frame * 0.018 + s.x));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Ground
    const grd = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    grd.addColorStop(0,   '#2d6e1a');
    grd.addColorStop(0.4, '#1e4811');
    grd.addColorStop(1,   '#0c2006');
    ctx.fillStyle = grd;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    // Ground edge
    ctx.fillStyle = '#48a020';
    ctx.fillRect(0, GROUND_Y, W, 3);

    // Grass tufts
    ctx.fillStyle = '#3a8818';
    for (let gx = 5; gx < W; gx += 20) {
      const ox = seededRand(99, gx) * 8 - 4;
      ctx.beginPath();
      ctx.moveTo(gx + ox,     GROUND_Y + 1);
      ctx.lineTo(gx + ox - 4, GROUND_Y - 7);
      ctx.lineTo(gx + ox + 4, GROUND_Y - 7);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawSlingshot() {
    const lTipX = SLING_X - 16, lTipY = SLING_Y - 16;
    const rTipX = SLING_X + 16, rTipY = SLING_Y - 16;

    // Trunk
    ctx.strokeStyle = '#5a3010';
    ctx.lineWidth   = 9;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(SLING_X, GROUND_Y + 2);
    ctx.lineTo(SLING_X, SLING_Y + 10);
    ctx.stroke();

    // Left prong
    ctx.beginPath();
    ctx.moveTo(SLING_X, SLING_Y + 10);
    ctx.lineTo(lTipX, lTipY);
    ctx.stroke();

    // Right prong
    ctx.beginPath();
    ctx.moveTo(SLING_X, SLING_Y + 10);
    ctx.lineTo(rTipX, rTipY);
    ctx.stroke();

    // Elastic bands (only when plane not flying)
    if (!plane.active) {
      const px = isDragging ? dragX : SLING_X;
      const py = isDragging ? dragY : SLING_Y;
      ctx.strokeStyle = '#c8a030';
      ctx.lineWidth   = 2.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(lTipX, lTipY);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rTipX, rTipY);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
  }

  function drawPlaneSprite(x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const dw = 60, dh = 20;
    if (planeImg.complete && planeImg.naturalWidth > 0) {
      ctx.scale(-1, 1);
      ctx.drawImage(planeImg, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.fillStyle = '#dce2f0';
      ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
    }
    ctx.restore();
  }

  function drawPlaneOnSling() {
    if (plane.active) return;
    const px = isDragging ? dragX : SLING_X;
    const py = isDragging ? dragY : SLING_Y;
    const angle = Math.atan2(SLING_Y - py, -(SLING_X - px));
    drawPlaneSprite(px, py, angle);
  }

  function drawFlyingPlane() {
    if (!plane.active) return;
    const angle = Math.atan2(plane.vy, plane.vx);
    ctx.save();
    ctx.translate(plane.x, plane.y);
    ctx.rotate(angle);
    const dw = 60, dh = 20;
    if (planeImg.complete && planeImg.naturalWidth > 0) {
      // Engine trail
      ctx.globalAlpha = 0.5;
      const trail = ctx.createLinearGradient(dw / 2, 0, dw / 2 + 28, 0);
      trail.addColorStop(0, 'rgba(255,200,50,0.9)');
      trail.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = trail;
      ctx.fillRect(dw / 2, -3, 28, 6);
      ctx.globalAlpha = 1;
      ctx.scale(-1, 1);
      ctx.drawImage(planeImg, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.fillStyle = '#dce2f0';
      ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
    }
    ctx.restore();
  }

  function drawTrajectoryDots() {
    if (!isDragging || plane.active) return;
    const dx = SLING_X - dragX;
    const dy = SLING_Y - dragY;
    let vx = dx * LAUNCH_PWR;
    let vy = dy * LAUNCH_PWR;
    let px = SLING_X, py = SLING_Y;
    ctx.save();
    for (let i = 0; i < 28; i++) {
      vy += GRAVITY;
      px += vx;
      py += vy;
      if (py > GROUND_Y || px > W) break;
      ctx.globalAlpha = (1 - i / 28) * 0.65;
      ctx.fillStyle   = '#fff';
      ctx.beginPath();
      ctx.arc(px, py, 3.5 - i * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTower(t) {
    if (t.destroyed) { drawRubble(t); return; }

    ctx.save();

    let sx = 0, sy = 0;
    if (t.shakeTimer > 0) {
      sx = (Math.random() - 0.5) * 7;
      sy = (Math.random() - 0.5) * 3;
      t.shakeTimer--;
    }

    if (t.falling) {
      // Pivot at base-centre, fall right
      t.fallAngle += 0.055;
      ctx.translate(t.x + t.w / 2, GROUND_Y);
      ctx.rotate(t.fallAngle);
      ctx.translate(-t.w / 2, -t.h);
    } else {
      ctx.translate(t.x + sx, t.y + sy);
    }

    const dmg = 1 - t.health / t.maxHealth;

    // Building body
    const bodyClr = dmg > 0
      ? `rgba(${60 + dmg * 80 | 0},${20},${20},0.92)`
      : 'rgba(22,32,70,0.92)';
    ctx.fillStyle = bodyClr;
    ctx.fillRect(0, 0, t.w, t.h);

    // Floor lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth   = 1;
    const flH = 15;
    for (let fy = flH; fy < t.h; fy += flH) {
      ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(t.w, fy); ctx.stroke();
    }

    // Windows
    const wW = 6, wH = 7;
    const cols = Math.max(1, (t.w / 22) | 0);
    const xPad = ((t.w - cols * (wW + 8)) / 2) | 0;
    let wIdx = 0;
    for (let fy = 8; fy < t.h - 16; fy += flH) {
      for (let c = 0; c < cols; c++) {
        const wx  = xPad + c * (wW + 8);
        const lit = seededRand(t.seed, wIdx++) > 0.3;
        if (lit && dmg === 0) {
          ctx.fillStyle = seededRand(t.seed, wIdx) > 0.2
            ? 'rgba(255,220,100,0.9)'
            : 'rgba(180,220,255,0.8)';
        } else if (dmg > 0) {
          ctx.fillStyle = 'rgba(255,80,40,0.5)';
        } else {
          ctx.fillStyle = 'rgba(5,8,20,0.9)';
        }
        ctx.fillRect(wx, fy, wW, wH);
      }
    }

    // Roof edge
    ctx.fillStyle = '#223060';
    ctx.fillRect(-2, -4, t.w + 4, 5);

    // Antenna
    const antX = t.w / 2;
    ctx.strokeStyle = '#2a3d6e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(antX, -4);
    ctx.lineTo(antX, -16);
    ctx.stroke();
    const blink = Math.sin(frame * 0.07 + t.seed) > 0.4;
    if (blink) {
      ctx.fillStyle = '#ff3333';
      ctx.beginPath();
      ctx.arc(antX, -17, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Professor on rooftop
    drawProfessor(t.w / 2, -4, dmg > 0);

    ctx.restore();
  }

  function drawProfessor(cx, baseY, scared) {
    ctx.save();
    ctx.translate(cx, baseY);

    // Head
    ctx.fillStyle = scared ? '#ffb080' : '#f5c89a';
    ctx.strokeStyle = scared ? '#c05020' : '#8a5a30';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(0, -28, 7, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Mortarboard
    ctx.fillStyle = '#111';
    ctx.fillRect(-9, -36, 18, 3);
    ctx.fillRect(-3, -42, 6, 7);
    // Tassel
    ctx.strokeStyle = '#D4A843';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(8, -36); ctx.lineTo(13, -28); ctx.stroke();
    ctx.fillStyle = '#D4A843';
    ctx.beginPath();
    ctx.arc(13, -28, 2, 0, Math.PI * 2); ctx.fill();

    // Body
    const bodyCol = scared ? '#c05020' : '#334488';
    ctx.strokeStyle = bodyCol;
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -21); ctx.lineTo(0, -8); ctx.stroke();

    // Arms
    if (scared) {
      // Panic arms up
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(-11, -24); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo( 11, -24); ctx.stroke();
    } else {
      // Normal arms – one holds a pointer
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(-8, -10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo( 9, -10); ctx.stroke();
      ctx.strokeStyle = '#D4A843'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(9, -10); ctx.lineTo(16, -4); ctx.stroke();
    }

    // Legs
    ctx.strokeStyle = bodyCol;
    ctx.lineWidth   = 2.5;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-6, 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo( 6, 4); ctx.stroke();

    // Scared face
    if (scared) {
      ctx.strokeStyle = '#333';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.arc(0, -26, 3.5, 0, Math.PI, false);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawRubble(t) {
    ctx.save();
    const chunks = [
      { ox: 2,        oy: -14, w: 20, h: 10, rot:  0.3 },
      { ox: 22,       oy: -8,  w: 15, h:  8, rot: -0.5 },
      { ox: t.w - 18, oy: -18, w: 22, h: 12, rot:  0.8 },
      { ox: 8,        oy: -24, w: 12, h:  8, rot: -0.2 }
    ];
    chunks.forEach(c => {
      ctx.save();
      ctx.translate(t.x + c.ox + c.w / 2, GROUND_Y + c.oy + c.h / 2);
      ctx.rotate(c.rot);
      ctx.fillStyle = '#1a2a5a';
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    });
    // Dust puff
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#c8a080';
    ctx.beginPath();
    ctx.arc(t.x + t.w / 2, GROUND_Y - 18, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHUD() {
    ctx.save();

    // Plane icons (left)
    ctx.font      = '14px Montserrat, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'left';
    ctx.fillText('Planes: ' + '✈ '.repeat(planesLeft).trim(), 16, 30);

    // Level (centre)
    ctx.textAlign = 'center';
    ctx.font      = 'bold 14px Montserrat, sans-serif';
    ctx.fillStyle = '#D4A843';
    ctx.fillText(`Level ${level}`, W / 2, 30);

    // Score (right)
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`Score: ${score}`, W - 16, 30);

    // Aim hint
    if (state === STATE.AIMING && !plane.active && !isDragging && resetTimer === 0) {
      ctx.textAlign   = 'center';
      ctx.font        = '13px Open Sans, sans-serif';
      ctx.fillStyle   = 'rgba(255,255,255,0.4)';
      ctx.fillText('Drag the plane to aim', W / 2, H - 12);
    }

    ctx.restore();
  }

  function drawIdleScreen() {
    ctx.save();
    ctx.fillStyle = 'rgba(6,9,26,0.75)';
    ctx.fillRect(0, 0, W, H);

    // Brand badge
    ctx.fillStyle = 'rgba(212,168,67,0.12)';
    rr(W / 2 - 135, 92, 270, 48, 10);
    ctx.fill();
    ctx.fillStyle = '#D4A843';
    ctx.font      = 'bold 12px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AFRICANA VIRTUAL AIRWAYS', W / 2, 122);

    ctx.fillStyle = '#fff';
    ctx.font      = 'bold 40px Montserrat, sans-serif';
    ctx.fillText('Angry Planes', W / 2, 192);

    ctx.fillStyle = 'rgba(255,200,100,0.85)';
    ctx.font      = 'italic 14px Open Sans, sans-serif';
    ctx.fillText("Prof's Worst Nightmare", W / 2, 220);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font      = '14px Open Sans, sans-serif';
    ctx.fillText('Drag the plane · Release to launch · Crash into towers!', W / 2, 254);

    if (bestScore > 0) {
      ctx.fillStyle = 'rgba(212,168,67,0.7)';
      ctx.font      = '13px Montserrat, sans-serif';
      ctx.fillText(`Best: ${bestScore}`, W / 2, 284);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font      = '13px Open Sans, sans-serif';
    ctx.fillText('Click & drag the plane on the slingshot to start', W / 2, H - 18);

    ctx.restore();
  }

  function drawLevelClearScreen() {
    ctx.save();
    ctx.fillStyle = 'rgba(6,9,26,0.80)';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#40ff80';
    ctx.font      = 'bold 34px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL CLEAR!', W / 2, 180);

    ctx.fillStyle = '#fff';
    ctx.font      = 'bold 18px Montserrat, sans-serif';
    ctx.fillText(`Score: ${score}`, W / 2, 220);

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font      = '14px Open Sans, sans-serif';
    ctx.fillText('Click or press SPACE for next level', W / 2, 260);
    ctx.restore();
  }

  function drawGameOverScreen() {
    ctx.save();
    ctx.fillStyle = 'rgba(6,9,26,0.85)';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#e02040';
    ctx.font      = 'bold 36px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MISSION FAILED', W / 2, 178);

    ctx.fillStyle = '#fff';
    ctx.font      = 'bold 20px Montserrat, sans-serif';
    ctx.fillText(`Final Score: ${score}`, W / 2, 220);

    if (score > 0 && score >= bestScore) {
      ctx.fillStyle = '#D4A843';
      ctx.font      = 'bold 14px Montserrat, sans-serif';
      ctx.fillText('✦ New Best! ✦', W / 2, 250);
    } else if (bestScore > 0) {
      ctx.fillStyle = 'rgba(212,168,67,0.6)';
      ctx.font      = '13px Montserrat, sans-serif';
      ctx.fillText(`Best: ${bestScore}`, W / 2, 250);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font      = '14px Open Sans, sans-serif';
    ctx.fillText('Click or press SPACE to try again', W / 2, 290);
    ctx.restore();
  }

  // ── Physics / collision ───────────────────────────────────────────

  function launch() {
    const dx  = SLING_X - dragX;
    const dy  = SLING_Y - dragY;
    plane.x   = dragX;
    plane.y   = dragY;
    plane.vx  = dx * LAUNCH_PWR;
    plane.vy  = dy * LAUNCH_PWR;
    plane.active = true;
    isDragging   = false;
    state        = STATE.FLYING;
  }

  function updatePlane() {
    if (!plane.active) return;
    plane.vy += GRAVITY;
    plane.x  += plane.vx;
    plane.y  += plane.vy;

    // Tower hit — plane passes through, slowing each time
    for (const t of towers) {
      if (t.destroyed || t.falling) continue;
      if (plane.hitSet.has(t)) continue;
      if (
        plane.x + 22 > t.x      && plane.x - 22 < t.x + t.w &&
        plane.y + 10 > t.y      && plane.y - 10 < t.y + t.h
      ) {
        plane.hitSet.add(t);
        t.health--;
        t.shakeTimer = 14;
        score += 50;
        if (elScore) elScore.textContent = score;
        if (t.health <= 0) {
          t.falling = true;
          score += 150;
          if (elScore) elScore.textContent = score;
        }
        // Lose ~30% speed on each tower punched through
        plane.vx *= 0.7;
        plane.vy *= 0.7;
      }
    }

    // Out of bounds or ground — plane is spent
    if (plane.x > W + 60 || plane.y > GROUND_Y + 20 || plane.x < -60) {
      plane.active = false;
      planesLeft--;
      resetTimer = 45;
      checkRound();
    }
  }

  function checkRound() {
    const alive = towers.filter(t => !t.destroyed && !t.falling);
    if (alive.length === 0) {
      score += planesLeft * 50;
      if (elScore) elScore.textContent = score;
      resetTimer = 0;
      setTimeout(() => { state = STATE.LEVEL_CLEAR; }, 700);
    } else if (planesLeft <= 0) {
      if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('afv_ap_best', bestScore);
        if (elBest) elBest.textContent = bestScore;
      }
      resetTimer = 0;
      setTimeout(() => { state = STATE.GAME_OVER; }, 900);
    }
  }

  // ── Main loop ─────────────────────────────────────────────────────

  function loop() {
    requestAnimationFrame(loop);
    frame++;

    drawBackground();

    // Advance falling towers
    towers.forEach(t => {
      if (t.falling && t.fallAngle > Math.PI / 2) {
        t.destroyed = true;
        t.falling   = false;
      }
    });

    towers.forEach(drawTower);

    updatePlane();

    // Countdown to reset plane on sling
    if (!plane.active && resetTimer > 0) {
      resetTimer--;
      if (resetTimer === 0 && state === STATE.FLYING) {
        resetPlane();
        state = STATE.AIMING;
      }
    }

    drawSlingshot();
    drawPlaneOnSling();
    drawFlyingPlane();
    drawTrajectoryDots();

    if (state !== STATE.IDLE) drawHUD();
    if (state === STATE.IDLE)        drawIdleScreen();
    if (state === STATE.LEVEL_CLEAR) drawLevelClearScreen();
    if (state === STATE.GAME_OVER)   drawGameOverScreen();
  }

  // ── Input ─────────────────────────────────────────────────────────

  function canvasPos(e) {
    const rect   = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const src    = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top)  * scaleY
    };
  }

  function nearSling(pos) {
    const px = isDragging ? dragX : SLING_X;
    const py = isDragging ? dragY : SLING_Y;
    const dx = pos.x - px, dy = pos.y - py;
    return Math.sqrt(dx * dx + dy * dy) < 45;
  }

  function onDown(e) {
    const pos = canvasPos(e);
    if (state === STATE.IDLE) {
      resetGame(); state = STATE.AIMING; return;
    }
    if (state === STATE.LEVEL_CLEAR) {
      nextLevel(); state = STATE.AIMING; return;
    }
    if (state === STATE.GAME_OVER) {
      resetGame(); state = STATE.AIMING; return;
    }
    if ((state === STATE.AIMING || state === STATE.FLYING) && !plane.active && resetTimer === 0) {
      if (nearSling(pos)) {
        isDragging = true;
        state      = STATE.AIMING;
        dragX      = pos.x;
        dragY      = pos.y;
      }
    }
  }

  function onMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const pos = canvasPos(e);
    const dx  = pos.x - SLING_X;
    const dy  = pos.y - SLING_Y;
    const d   = Math.sqrt(dx * dx + dy * dy);
    if (d > MAX_PULL) {
      dragX = SLING_X + (dx / d) * MAX_PULL;
      dragY = SLING_Y + (dy / d) * MAX_PULL;
    } else {
      dragX = pos.x;
      dragY = pos.y;
    }
  }

  function onUp() {
    if (!isDragging) return;
    isDragging = false;
    const dx = SLING_X - dragX, dy = SLING_Y - dragY;
    if (Math.sqrt(dx * dx + dy * dy) > 12) {
      launch();
    } else {
      dragX = SLING_X;
      dragY = SLING_Y;
    }
  }

  function onKey(e) {
    if (e.code !== 'Space') return;
    e.preventDefault();
    if (state === STATE.IDLE)        { resetGame(); state = STATE.AIMING; }
    else if (state === STATE.LEVEL_CLEAR) { nextLevel(); state = STATE.AIMING; }
    else if (state === STATE.GAME_OVER)   { resetGame(); state = STATE.AIMING; }
  }

  canvas.addEventListener('mousedown',  onDown);
  canvas.addEventListener('mousemove',  onMove);
  canvas.addEventListener('mouseup',    onUp);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); onDown(e); }, { passive: false });
  canvas.addEventListener('touchmove',  e => { e.preventDefault(); onMove(e); }, { passive: false });
  canvas.addEventListener('touchend',   e => { e.preventDefault(); onUp();    }, { passive: false });
  document.addEventListener('keydown',  onKey);

  // ── Boot ──────────────────────────────────────────────────────────
  resetGame();
  loop();
})();
