/**
 * Africana Airways — Flappy Plane
 * Canvas-based game. Space / tap to thrust.
 */

(function () {
  const canvas  = document.getElementById('flappyCanvas');
  const ctx     = canvas.getContext('2d');
  const W = 860, H = 460;
  canvas.width  = W;
  canvas.height = H;

  // ── Score DOM elements ──────────────────────────────────────────
  const elScore    = document.getElementById('fpScore');
  const elBest     = document.getElementById('fpBest');
  let bestScore    = parseInt(localStorage.getItem('afv_fp_best') || '0', 10);
  if (elBest) elBest.textContent = bestScore;

  // ── Game state ──────────────────────────────────────────────────
  const STATE = { IDLE: 0, PLAYING: 1, DEAD: 2 };
  let state     = STATE.IDLE;
  let score     = 0;
  let frame     = 0;
  let animId    = null;

  // ── Physics ─────────────────────────────────────────────────────
  const GRAVITY   = 0.16;
  const FLAP      = -5.5;
  const PIPE_SPEED = 1.8;
  const PIPE_GAP  = 240;
  const PIPE_INTERVAL = 130; // frames between new pipes

  let planeY, planeVY;

  // ── Pipes ────────────────────────────────────────────────────────
  let pipes = [];

  // ── Stars (static) ──────────────────────────────────────────────
  const STARS = Array.from({ length: 90 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H * 0.7,
    r: Math.random() * 1.4 + 0.3,
    a: Math.random() * 0.6 + 0.3
  }));

  // ── Background mountains ─────────────────────────────────────────
  const MOUNTAINS = buildMountains();

  function buildMountains() {
    const pts = [[0, H]];
    let x = 0;
    while (x < W + 80) {
      x += 50 + Math.random() * 70;
      const y = H * 0.55 + Math.random() * H * 0.2;
      pts.push([x, y]);
    }
    pts.push([W + 80, H]);
    return pts;
  }

  // ── Cloud objects for scrolling bg ──────────────────────────────
  let bgClouds = buildClouds();

  function buildClouds() {
    return Array.from({ length: 8 }, (_, i) => ({
      x: (i / 8) * W + Math.random() * 80,
      y: 40 + Math.random() * 140,
      s: 0.6 + Math.random() * 0.8,
      speed: 0.4 + Math.random() * 0.3
    }));
  }

  // ── Plane ────────────────────────────────────────────────────────
  const PLANE_X  = 140;
  const PLANE_W  = 88;  // hitbox width
  const PLANE_H  = 25;  // hitbox height

  // Sprite — loaded from PNG; falls back to shape if missing
  const planeImg = new Image();
  planeImg.src   = 'assets/img/plane.png';

  function resetGame() {
    planeY  = H / 2;
    planeVY = 0;
    pipes   = [];
    score   = 0;
    frame   = 0;
    if (elScore) elScore.textContent = '0';
  }

  // ── Draw helpers ─────────────────────────────────────────────────

  function drawBackground() {
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0,   '#050b1f');
    grad.addColorStop(0.55,'#0d1b3e');
    grad.addColorStop(1,   '#1a2a50');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    STARS.forEach(s => {
      ctx.globalAlpha = s.a * (0.7 + 0.3 * Math.sin(frame * 0.03 + s.x));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Background mountains
    ctx.fillStyle = 'rgba(10,20,55,0.7)';
    ctx.beginPath();
    ctx.moveTo(MOUNTAINS[0][0], MOUNTAINS[0][1]);
    MOUNTAINS.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath();
    ctx.fill();

    // Scrolling background clouds
    bgClouds.forEach(c => {
      drawCloud(c.x, c.y, c.s, 0.18);
      if (state === STATE.PLAYING) {
        c.x -= c.speed;
        if (c.x < -120) { c.x = W + 60; c.y = 40 + Math.random() * 140; }
      }
    });

    // Ground strip
    ctx.fillStyle = '#0a1632';
    ctx.fillRect(0, H - 36, W, 36);
    ctx.fillStyle = '#D4A843';
    ctx.fillRect(0, H - 36, W, 2);

    // Ground markings
    ctx.fillStyle = 'rgba(212,168,67,0.25)';
    for (let x = (frame * 4) % 80; x < W; x += 80) {
      ctx.fillRect(x, H - 20, 40, 3);
    }
  }

  function drawCloud(cx, cy, scale, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = '#a8c0ff';
    const blobs = [
      [0, 0, 28], [-22, 8, 20], [22, 8, 20], [-10, 14, 16], [12, 14, 16]
    ];
    blobs.forEach(([bx, by, br]) => {
      ctx.beginPath();
      ctx.arc(cx + bx * scale, cy + by * scale, br * scale, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawPlane(x, y, vy) {
    const angle = Math.max(-0.42, Math.min(0.55, vy * 0.045));
    // Draw at 2× hitbox size so the sprite looks right at game scale
    const dw = PLANE_W * 2;
    const dh = PLANE_H * 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    if (planeImg.complete && planeImg.naturalWidth > 0) {
      // Engine thrust flicker behind the tail (left side of sprite)
      if (state === STATE.PLAYING && vy < 0) {
        const flicker = Math.random();
        const grd = ctx.createLinearGradient(-dw / 2 - 24, 0, -dw / 2, 0);
        grd.addColorStop(0, 'rgba(255,180,50,0)');
        grd.addColorStop(0.5, `rgba(255,140,30,${0.5 + flicker * 0.4})`);
        grd.addColorStop(1, `rgba(255,220,80,${0.7 + flicker * 0.2})`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(-dw / 2 + 4, -4);
        ctx.lineTo(-dw / 2 - 20 - flicker * 10, 0);
        ctx.lineTo(-dw / 2 + 4, 4);
        ctx.closePath();
        ctx.fill();
      }

      ctx.scale(-1, 1);
      ctx.drawImage(planeImg, -dw / 2, -dh / 2, dw, dh);
    } else {
      // Fallback shape while image loads
      ctx.fillStyle = '#dce2f0';
      ctx.fillRect(-PLANE_W / 2, -PLANE_H / 2, PLANE_W, PLANE_H);
    }

    ctx.restore();
  }

  // ── Building obstacles ────────────────────────────────────────────

  // Tiny deterministic pseudo-random from a seed
  function seededRand(seed, i) {
    const x = Math.sin(seed + i) * 43758.5453;
    return x - Math.floor(x);
  }

  function drawPipe(pipe) {
    const x      = pipe.x;
    const gapTop = pipe.gapTop;
    const gapBot = gapTop + PIPE_GAP;

    drawBuildingColumn(x, 0,      gapTop, pipe.seed,       true);   // top (hanging down)
    drawBuildingColumn(x, gapBot, H - 36, pipe.seed + 500, false);  // bottom (rising up)
  }

  function drawBuildingColumn(x, yTop, yBot, seed, isTop) {
    const colW   = 72;
    const height = yBot - yTop;
    if (height <= 0) return;

    // ── Background fill ──────────────────────────────────────────────
    ctx.fillStyle = '#0d1220';
    ctx.fillRect(x, yTop, colW, height);

    // ── Two sub-buildings side by side within the column ─────────────
    const bldgs = [
      { bx: x,      bw: 44 },
      { bx: x + 46, bw: 26 }
    ];

    bldgs.forEach((b, bi) => {
      // Each building gets a slightly different height inset on the rooftop edge
      const inset = seededRand(seed, bi * 7) * 12;
      let bTop = yTop, bBot = yBot;
      if (isTop)  bTop += inset;
      else        bBot -= inset;

      // Building body
      const shade = 0.12 + seededRand(seed, bi * 3) * 0.08;
      ctx.fillStyle = `rgba(20,30,60,${0.85 + shade})`;
      ctx.fillRect(b.bx, bTop, b.bw, bBot - bTop);

      // Subtle facade lines (floors)
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth   = 1;
      const floorH = 14;
      for (let fy = bTop + floorH; fy < bBot - 4; fy += floorH) {
        ctx.beginPath();
        ctx.moveTo(b.bx, fy);
        ctx.lineTo(b.bx + b.bw, fy);
        ctx.stroke();
      }

      // Windows — 2 columns, every floor
      const winW = 5, winH = 6, winCols = 2;
      const colSpacing = Math.floor((b.bw - winW * winCols) / (winCols + 1));
      let winIdx = 0;
      for (let fy = bTop + 6; fy < bBot - 10; fy += floorH) {
        for (let col = 0; col < winCols; col++) {
          const wx = b.bx + colSpacing + col * (winW + colSpacing);
          const lit = seededRand(seed + bi * 100, winIdx++) > 0.28;
          if (lit) {
            // Warm window glow
            ctx.fillStyle = seededRand(seed, winIdx) > 0.15
              ? 'rgba(255,220,100,0.85)'
              : 'rgba(180,220,255,0.75)';
            ctx.fillRect(wx, fy, winW, winH);
            // Bloom
            ctx.save();
            ctx.globalAlpha = 0.12;
            ctx.fillStyle   = '#ffe066';
            ctx.fillRect(wx - 2, fy - 2, winW + 4, winH + 4);
            ctx.restore();
          } else {
            ctx.fillStyle = 'rgba(10,15,35,0.9)';
            ctx.fillRect(wx, fy, winW, winH);
          }
        }
      }

      // Rooftop edge details (antenna / ledge on the gap-facing side)
      const roofY = isTop ? bBot : bTop;
      ctx.fillStyle = '#1a2540';
      ctx.fillRect(b.bx, isTop ? roofY - 3 : roofY, b.bw, 3);

      // Antenna on tallest building (bi===0) at rooftop edge
      if (bi === 0) {
        const antX = b.bx + b.bw / 2;
        const antH = 10 + seededRand(seed, 99) * 10;
        const antY = isTop ? roofY - 3 - antH : roofY;
        ctx.strokeStyle = '#2a3d6e';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(antX, isTop ? roofY - 3 : roofY + 3);
        ctx.lineTo(antX, antY);
        ctx.stroke();
        // Blinking red light
        const blink = Math.sin(frame * 0.06 + seed) > 0.4;
        if (blink) {
          ctx.fillStyle = '#ff3333';
          ctx.beginPath();
          ctx.arc(antX, antY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    // ── Gap-edge glow ────────────────────────────────────────────────
    const edgeY = isTop ? yBot - 4 : yTop;
    const grd   = ctx.createLinearGradient(x, edgeY, x, edgeY + (isTop ? 4 : -4));
    grd.addColorStop(0, 'rgba(212,168,67,0.5)');
    grd.addColorStop(1, 'rgba(212,168,67,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(x, isTop ? yBot - 4 : yTop, colW, 4);
  }

  // ── HUD ──────────────────────────────────────────────────────────
  function drawHUD() {
    ctx.save();
    ctx.font = 'bold 34px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(score, W / 2, 54);
    ctx.restore();
  }

  // ── Screens ──────────────────────────────────────────────────────
  function drawIdleScreen() {
    ctx.save();
    ctx.fillStyle = 'rgba(6,9,26,0.72)';
    ctx.fillRect(0, 0, W, H);

    // Logo strip
    ctx.fillStyle = 'rgba(212,168,67,0.12)';
    roundRect(ctx, W/2 - 120, 100, 240, 50, 10);
    ctx.fill();

    ctx.fillStyle = '#D4A843';
    ctx.font = 'bold 13px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '0.15em';
    ctx.fillText('AFRICANA VIRTUAL AIRWAYS', W / 2, 131);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 38px Montserrat, sans-serif';
    ctx.fillText('Flappy Plane', W / 2, 200);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '15px Open Sans, sans-serif';
    ctx.fillText('Press  SPACE  or  TAP  to take off', W / 2, 244);

    if (bestScore > 0) {
      ctx.fillStyle = 'rgba(212,168,67,0.7)';
      ctx.font = '13px Montserrat, sans-serif';
      ctx.fillText(`Best: ${bestScore}`, W / 2, 278);
    }

    ctx.restore();
  }

  function drawDeadScreen() {
    ctx.save();
    ctx.fillStyle = 'rgba(6,9,26,0.80)';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#e02040';
    ctx.font = 'bold 36px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MAYDAY', W / 2, 175);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Montserrat, sans-serif';
    ctx.fillText(`Score: ${score}`, W / 2, 220);

    if (score >= bestScore && score > 0) {
      ctx.fillStyle = '#D4A843';
      ctx.font = 'bold 14px Montserrat, sans-serif';
      ctx.fillText('✦ New Best! ✦', W / 2, 248);
    } else if (bestScore > 0) {
      ctx.fillStyle = 'rgba(212,168,67,0.6)';
      ctx.font = '13px Montserrat, sans-serif';
      ctx.fillText(`Best: ${bestScore}`, W / 2, 248);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '14px Open Sans, sans-serif';
    ctx.fillText('Press  SPACE  or  TAP  to try again', W / 2, 290);

    ctx.restore();
  }

  // ── Collision ────────────────────────────────────────────────────
  function checkCollision() {
    const px  = PLANE_X;
    const py  = planeY;
    const hw  = 26, hh = 11; // half-box

    // Ground / ceiling
    if (py - hh < 0 || py + hh > H - 36) return true;

    // Pipes
    for (const pipe of pipes) {
      const px1 = pipe.x, px2 = pipe.x + 72;
      if (px + hw < px1 || px - hw > px2) continue;
      if (py - hh < pipe.gapTop || py + hh > pipe.gapTop + PIPE_GAP) return true;
    }

    return false;
  }

  // ── Main loop ────────────────────────────────────────────────────
  function loop() {
    animId = requestAnimationFrame(loop);
    frame++;

    drawBackground();

    if (state === STATE.PLAYING) {
      // Physics
      planeVY += GRAVITY;
      planeY  += planeVY;

      // Spawn pipes
      if (frame % PIPE_INTERVAL === 0) {
        const minGapTop = 70;
        const maxGapTop = H - 36 - PIPE_GAP - 70;
        pipes.push({
          x:       W + 10,
          gapTop:  minGapTop + Math.random() * (maxGapTop - minGapTop),
          passed:  false,
          seed:    Math.random() * 1000 | 0
        });
      }

      // Move pipes + score
      pipes.forEach(p => {
        p.x -= PIPE_SPEED;
        if (!p.passed && p.x + 72 < PLANE_X) {
          p.passed = true;
          score++;
          if (elScore) elScore.textContent = score;
        }
      });
      pipes = pipes.filter(p => p.x > -80);

      // Collision
      if (checkCollision()) {
        state = STATE.DEAD;
        if (score > bestScore) {
          bestScore = score;
          localStorage.setItem('afv_fp_best', bestScore);
          if (elBest) elBest.textContent = bestScore;
        }
      }
    }

    // Draw pipes
    pipes.forEach(drawPipe);

    // Draw plane
    drawPlane(PLANE_X, planeY, planeVY);

    // HUD
    if (state === STATE.PLAYING) drawHUD();
    if (state === STATE.IDLE)    drawIdleScreen();
    if (state === STATE.DEAD)    drawDeadScreen();
  }

  // ── Input ────────────────────────────────────────────────────────
  function flap() {
    if (state === STATE.IDLE) {
      resetGame();
      state = STATE.PLAYING;
      return;
    }
    if (state === STATE.DEAD) {
      resetGame();
      state = STATE.PLAYING;
      return;
    }
    if (state === STATE.PLAYING) {
      planeVY = FLAP;
    }
  }

  document.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); flap(); }
  });
  canvas.addEventListener('click',     flap);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); flap(); }, { passive: false });

  // ── Boot ─────────────────────────────────────────────────────────
  resetGame();
  loop();
})();
