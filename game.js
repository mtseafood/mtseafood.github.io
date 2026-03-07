/* =========================================
   Tower Defense — Game Engine
   ========================================= */

(() => {
'use strict';

// ============ CONSTANTS ============
const COLS = 20;
const ROWS = 14;
const FPS = 60;

// ============ DOM ============
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const goldDisplay = document.getElementById('gold-display');
const livesDisplay = document.getElementById('lives-display');
const waveDisplay = document.getElementById('wave-display');
const scoreDisplay = document.getElementById('score-display');
const btnStartWave = document.getElementById('btn-start-wave');
const btnFast = document.getElementById('btn-fast');
const btnSell = document.getElementById('btn-sell');
const infoContent = document.getElementById('info-content');
const overlay = document.getElementById('overlay');
const overlayInner = document.getElementById('overlay-inner');
const towerCards = document.querySelectorAll('.tower-card');

// ============ GAME STATE ============
let tileSize = 50;
let gold = 200;
let lives = 20;
let score = 0;
let currentWave = 0;
let waveActive = false;
let gameOver = false;
let gameSpeed = 1;
let selectedTowerType = null;
let selectedPlacedTower = null;
let mouseGridX = -1;
let mouseGridY = -1;

// Collections
let towers = [];
let enemies = [];
let projectiles = [];
let particles = [];
let floatingTexts = [];

// ============ PATH DEFINITION ============
// Waypoints define the enemy path across the grid (col, row)
const PATH_WAYPOINTS = [
    { x: 0, y: 3 },
    { x: 4, y: 3 },
    { x: 4, y: 1 },
    { x: 8, y: 1 },
    { x: 8, y: 5 },
    { x: 2, y: 5 },
    { x: 2, y: 8 },
    { x: 6, y: 8 },
    { x: 6, y: 11 },
    { x: 10, y: 11 },
    { x: 10, y: 7 },
    { x: 14, y: 7 },
    { x: 14, y: 3 },
    { x: 18, y: 3 },
    { x: 18, y: 10 },
    { x: 15, y: 10 },
    { x: 15, y: 13 },
    { x: 19, y: 13 },
];

// Build set of path tiles for quick lookup
const pathTiles = new Set();
function buildPathTiles() {
    for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
        const a = PATH_WAYPOINTS[i];
        const b = PATH_WAYPOINTS[i + 1];
        if (a.x === b.x) {
            const minY = Math.min(a.y, b.y);
            const maxY = Math.max(a.y, b.y);
            for (let y = minY; y <= maxY; y++) pathTiles.add(`${a.x},${y}`);
        } else {
            const minX = Math.min(a.x, b.x);
            const maxX = Math.max(a.x, b.x);
            for (let x = minX; x <= maxX; x++) pathTiles.add(`${x},${a.y}`);
        }
    }
}
buildPathTiles();

// Build smooth pixel path for enemies to follow
function buildPixelPath() {
    const points = [];
    for (let i = 0; i < PATH_WAYPOINTS.length; i++) {
        points.push({
            x: PATH_WAYPOINTS[i].x * tileSize + tileSize / 2,
            y: PATH_WAYPOINTS[i].y * tileSize + tileSize / 2
        });
    }
    return points;
}

let pixelPath = buildPixelPath();

// ============ TOWER DEFINITIONS ============
const TOWER_DEFS = {
    archer: {
        name: 'Archer', icon: '🏹', cost: 50,
        damage: 15, range: 3, fireRate: 0.5,
        color: '#4ae08a', projColor: '#4ae08a', projSpeed: 8,
        special: 'none', splashRadius: 0, chainCount: 0,
        upgrades: [
            { cost: 40, damage: 22, range: 3.5, fireRate: 0.4 },
            { cost: 80, damage: 35, range: 4, fireRate: 0.3 },
        ],
    },
    fire: {
        name: 'Fire', icon: '🔥', cost: 100,
        damage: 30, range: 2.5, fireRate: 0.8,
        color: '#ff8844', projColor: '#ff6622', projSpeed: 6,
        special: 'splash', splashRadius: 1.2, chainCount: 0,
        upgrades: [
            { cost: 75, damage: 45, range: 3, fireRate: 0.7 },
            { cost: 120, damage: 70, range: 3.5, fireRate: 0.6 },
        ],
    },
    ice: {
        name: 'Ice', icon: '❄️', cost: 75,
        damage: 10, range: 3, fireRate: 0.7,
        color: '#88ccff', projColor: '#66bbff', projSpeed: 7,
        special: 'slow', splashRadius: 0, chainCount: 0, slowFactor: 0.5,
        upgrades: [
            { cost: 55, damage: 18, range: 3.5, fireRate: 0.6 },
            { cost: 100, damage: 28, range: 4, fireRate: 0.5, slowFactor: 0.3 },
        ],
    },
    lightning: {
        name: 'Lightning', icon: '⚡', cost: 150,
        damage: 50, range: 4, fireRate: 1.2,
        color: '#a86eff', projColor: '#c49aff', projSpeed: 12,
        special: 'chain', splashRadius: 0, chainCount: 3,
        upgrades: [
            { cost: 100, damage: 75, range: 4.5, fireRate: 1.0 },
            { cost: 160, damage: 110, range: 5, fireRate: 0.8, chainCount: 5 },
        ],
    },
};

// ============ ENEMY DEFINITIONS ============
const ENEMY_DEFS = {
    goblin:      { name: 'Goblin',      hp: 50,  speed: 2.0, gold: 10, color: '#44dd66', radius: 0.3 },
    orc:         { name: 'Orc',         hp: 120, speed: 1.5, gold: 20, color: '#aa7744', radius: 0.38 },
    darkKnight:  { name: 'Dark Knight', hp: 250, speed: 1.0, gold: 40, color: '#8899aa', radius: 0.4 },
    dragon:      { name: 'Dragon',      hp: 500, speed: 1.8, gold: 80, color: '#ff4444', radius: 0.42 },
};

// ============ WAVE DEFINITIONS ============
const WAVES = [
    // wave 1-5: introductory
    [{ type: 'goblin', count: 6, interval: 0.9 }],
    [{ type: 'goblin', count: 10, interval: 0.8 }],
    [{ type: 'goblin', count: 8, interval: 0.7 }, { type: 'orc', count: 2, interval: 1.2 }],
    [{ type: 'orc', count: 6, interval: 1.0 }],
    [{ type: 'goblin', count: 12, interval: 0.5 }, { type: 'orc', count: 4, interval: 1.0 }],
    // wave 6-10: mid game
    [{ type: 'orc', count: 8, interval: 0.8 }, { type: 'darkKnight', count: 2, interval: 1.5 }],
    [{ type: 'darkKnight', count: 5, interval: 1.2 }],
    [{ type: 'goblin', count: 15, interval: 0.3 }, { type: 'darkKnight', count: 3, interval: 1.3 }],
    [{ type: 'orc', count: 10, interval: 0.6 }, { type: 'darkKnight', count: 5, interval: 1.0 }],
    [{ type: 'dragon', count: 2, interval: 2.0 }, { type: 'orc', count: 8, interval: 0.7 }],
    // wave 11-15: late game
    [{ type: 'darkKnight', count: 10, interval: 0.8 }, { type: 'dragon', count: 2, interval: 1.5 }],
    [{ type: 'dragon', count: 4, interval: 1.5 }, { type: 'goblin', count: 20, interval: 0.25 }],
    [{ type: 'darkKnight', count: 12, interval: 0.6 }, { type: 'dragon', count: 3, interval: 1.2 }],
    [{ type: 'dragon', count: 6, interval: 1.0 }, { type: 'orc', count: 10, interval: 0.5 }],
    [{ type: 'dragon', count: 10, interval: 0.8 }, { type: 'darkKnight', count: 8, interval: 0.6 }],
];

let waveQueue = []; // remaining enemies to spawn
let waveSpawnTimer = 0;

// ============ RESIZE ============
function resize() {
    const area = document.getElementById('game-area');
    const sidebar = document.getElementById('sidebar');
    const availW = area.clientWidth - sidebar.offsetWidth;
    const availH = area.clientHeight;
    tileSize = Math.floor(Math.min(availW / COLS, availH / ROWS));
    canvas.width = COLS * tileSize;
    canvas.height = ROWS * tileSize;
    pixelPath = buildPixelPath();
}
window.addEventListener('resize', resize);

// ============ DRAWING HELPERS ============
function drawGrid() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const x = c * tileSize;
            const y = r * tileSize;
            const isPath = pathTiles.has(`${c},${r}`);

            if (isPath) {
                ctx.fillStyle = '#1a2540';
            } else {
                ctx.fillStyle = (c + r) % 2 === 0 ? '#0f1826' : '#111c2e';
            }
            ctx.fillRect(x, y, tileSize, tileSize);

            if (isPath) {
                ctx.fillStyle = 'rgba(74, 158, 255, 0.04)';
                ctx.fillRect(x, y, tileSize, tileSize);
            }
        }
    }

    // Path direction indicators
    ctx.strokeStyle = 'rgba(74, 158, 255, 0.12)';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    for (let i = 0; i < pixelPath.length; i++) {
        if (i === 0) ctx.moveTo(pixelPath[i].x, pixelPath[i].y);
        else ctx.lineTo(pixelPath[i].x, pixelPath[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Entry/exit markers
    const entry = pixelPath[0];
    const exit = pixelPath[pixelPath.length - 1];
    ctx.fillStyle = 'rgba(74, 224, 138, 0.3)';
    ctx.beginPath();
    ctx.arc(entry.x, entry.y, tileSize * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4ae08a';
    ctx.font = `bold ${tileSize * 0.3}px ${getComputedStyle(document.body).fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▶', entry.x, entry.y);

    ctx.fillStyle = 'rgba(255, 77, 106, 0.3)';
    ctx.beginPath();
    ctx.arc(exit.x, exit.y, tileSize * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff4d6a';
    ctx.fillText('■', exit.x, exit.y);
}

function drawHoverTile() {
    if (selectedTowerType && mouseGridX >= 0 && mouseGridX < COLS && mouseGridY >= 0 && mouseGridY < ROWS) {
        const canPlace = !pathTiles.has(`${mouseGridX},${mouseGridY}`) &&
                         !towers.find(t => t.gridX === mouseGridX && t.gridY === mouseGridY);
        const x = mouseGridX * tileSize;
        const y = mouseGridY * tileSize;
        ctx.fillStyle = canPlace ? 'rgba(74, 224, 138, 0.2)' : 'rgba(255, 77, 106, 0.2)';
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.strokeStyle = canPlace ? 'rgba(74, 224, 138, 0.5)' : 'rgba(255, 77, 106, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);

        // Range preview
        if (canPlace) {
            const def = TOWER_DEFS[selectedTowerType];
            const cx = x + tileSize / 2;
            const cy = y + tileSize / 2;
            ctx.strokeStyle = 'rgba(74, 224, 138, 0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx, cy, def.range * tileSize, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

function drawTowers() {
    for (const tower of towers) {
        const cx = tower.gridX * tileSize + tileSize / 2;
        const cy = tower.gridY * tileSize + tileSize / 2;
        const def = TOWER_DEFS[tower.type];

        // Base
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, tileSize * 0.42);
        grad.addColorStop(0, def.color);
        grad.addColorStop(1, adjustAlpha(def.color, 0.3));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, tileSize * 0.38, 0, Math.PI * 2);
        ctx.fill();

        // Border ring
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, tileSize * 0.38, 0, Math.PI * 2);
        ctx.stroke();

        // Icon
        ctx.font = `${tileSize * 0.45}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.icon, cx, cy);

        // Level indicator
        if (tower.level > 0) {
            const starSize = tileSize * 0.12;
            for (let i = 0; i <= tower.level; i++) {
                const sx = cx - ((tower.level) * starSize) + i * starSize * 2;
                const sy = cy + tileSize * 0.32;
                ctx.fillStyle = '#ffc857';
                ctx.font = `${starSize * 2}px serif`;
                ctx.fillText('★', sx, sy);
            }
        }

        // Selected tower range
        if (selectedPlacedTower === tower) {
            ctx.strokeStyle = 'rgba(74, 158, 255, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(cx, cy, tower.range * tileSize, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Highlight
            ctx.strokeStyle = var_accent();
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, tileSize * 0.42, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

function drawEnemies() {
    for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const r = enemy.radius * tileSize;

        // Glow
        ctx.shadowColor = enemy.color;
        ctx.shadowBlur = 10;

        // Body
        ctx.fillStyle = enemy.color;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;

        // Inner highlight
        const igr = ctx.createRadialGradient(enemy.x - r * 0.3, enemy.y - r * 0.3, 0, enemy.x, enemy.y, r);
        igr.addColorStop(0, 'rgba(255,255,255,0.3)');
        igr.addColorStop(1, 'transparent');
        ctx.fillStyle = igr;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Slow indicator
        if (enemy.slowTimer > 0) {
            ctx.strokeStyle = 'rgba(100, 180, 255, 0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, r + 3, 0, Math.PI * 2);
            ctx.stroke();
        }

        // HP bar
        const barW = r * 2.2;
        const barH = 4;
        const barX = enemy.x - barW / 2;
        const barY = enemy.y - r - 8;
        const hpPct = enemy.hp / enemy.maxHp;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = hpPct > 0.5 ? '#4ae08a' : hpPct > 0.25 ? '#ffc857' : '#ff4d6a';
        ctx.fillRect(barX, barY, barW * hpPct, barH);
    }
}

function drawProjectiles() {
    for (const p of projectiles) {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Trail
        ctx.strokeStyle = adjustAlpha(p.color, 0.4);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
        ctx.stroke();

        ctx.shadowBlur = 0;
    }
}

function drawParticles() {
    for (const p of particles) {
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = adjustAlpha(p.color, alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawFloatingTexts() {
    for (const ft of floatingTexts) {
        const alpha = ft.life / ft.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ft.color;
        ctx.font = `bold ${ft.size}px ${getComputedStyle(document.body).fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1;
    }
}

// ============ HELPERS ============
function adjustAlpha(hex, alpha) {
    let r, g, b;
    if (hex.startsWith('#') && hex.length === 7) {
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
    } else if (hex.startsWith('rgba')) {
        const m = hex.match(/[\d.]+/g);
        r = parseInt(m[0]); g = parseInt(m[1]); b = parseInt(m[2]);
    } else {
        return hex;
    }
    return `rgba(${r},${g},${b},${alpha})`;
}

function var_accent() { return '#4a9eff'; }

function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function spawnParticles(x, y, color, count, speed, size) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = (0.5 + Math.random()) * speed;
        particles.push({
            x, y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            color,
            size: size * (0.5 + Math.random()),
            life: 0.4 + Math.random() * 0.4,
            maxLife: 0.4 + Math.random() * 0.4,
        });
        particles[particles.length - 1].maxLife = particles[particles.length - 1].life;
    }
}

function spawnFloatingText(x, y, text, color, size) {
    floatingTexts.push({
        x, y, text, color, size: size || 14,
        vy: -1.5,
        life: 1.0, maxLife: 1.0,
    });
}

// ============ ENEMY CLASS ============
function createEnemy(type) {
    const def = ENEMY_DEFS[type];
    const hpScale = 1 + currentWave * 0.08; // enemies scale slightly each wave
    return {
        type,
        name: def.name,
        x: pixelPath[0].x,
        y: pixelPath[0].y,
        hp: Math.floor(def.hp * hpScale),
        maxHp: Math.floor(def.hp * hpScale),
        speed: def.speed,
        baseSpeed: def.speed,
        color: def.color,
        radius: def.radius,
        gold: def.gold,
        alive: true,
        pathIndex: 0,
        distTraveled: 0,
        slowTimer: 0,
        slowFactor: 1,
    };
}

// ============ TOWER CLASS ============
function createTower(type, gridX, gridY) {
    const def = TOWER_DEFS[type];
    return {
        type,
        gridX, gridY,
        damage: def.damage,
        range: def.range,
        fireRate: def.fireRate,
        fireCooldown: 0,
        level: 0,
        kills: 0,
        totalDamage: 0,
    };
}

// ============ TOWER LOGIC ============
function updateTowers(dt) {
    for (const tower of towers) {
        tower.fireCooldown -= dt;
        if (tower.fireCooldown > 0) continue;

        const def = TOWER_DEFS[tower.type];
        const cx = tower.gridX * tileSize + tileSize / 2;
        const cy = tower.gridY * tileSize + tileSize / 2;
        const rangePixels = tower.range * tileSize;

        // Find target — closest enemy in range
        let target = null;
        let bestDist = Infinity;
        for (const enemy of enemies) {
            if (!enemy.alive) continue;
            const d = dist(cx, cy, enemy.x, enemy.y);
            if (d <= rangePixels && d < bestDist) {
                bestDist = d;
                target = enemy;
            }
        }

        if (target) {
            tower.fireCooldown = tower.fireRate;
            fireProjectile(tower, target, def, cx, cy);
        }
    }
}

function fireProjectile(tower, target, def, fromX, fromY) {
    const dx = target.x - fromX;
    const dy = target.y - fromY;
    const len = Math.sqrt(dx * dx + dy * dy);
    const speed = def.projSpeed * tileSize / 50; // scale with tile size

    projectiles.push({
        x: fromX,
        y: fromY,
        vx: (dx / len) * speed,
        vy: (dy / len) * speed,
        damage: tower.damage,
        color: def.projColor,
        towerType: tower.type,
        tower,
        special: def.special,
        splashRadius: def.splashRadius,
        chainCount: tower.level >= 2 && def.upgrades[1].chainCount ? def.upgrades[1].chainCount : def.chainCount,
        slowFactor: tower.level >= 2 && def.upgrades[1].slowFactor ? def.upgrades[1].slowFactor : (def.slowFactor || 1),
        target,
        alive: true,
    });
}

// ============ PROJECTILE LOGIC ============
function updateProjectiles(dt) {
    const speed = dt * 60;
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.vx * speed;
        p.y += p.vy * speed;

        // Off screen?
        if (p.x < -50 || p.x > canvas.width + 50 || p.y < -50 || p.y > canvas.height + 50) {
            projectiles.splice(i, 1);
            continue;
        }

        // Hit enemy?
        for (const enemy of enemies) {
            if (!enemy.alive) continue;
            const d = dist(p.x, p.y, enemy.x, enemy.y);
            if (d < enemy.radius * tileSize + 4) {
                applyHit(p, enemy);
                projectiles.splice(i, 1);
                break;
            }
        }
    }
}

function applyHit(projectile, enemy) {
    const p = projectile;

    // Direct damage
    damageEnemy(enemy, p.damage, p.tower);

    // Particles
    spawnParticles(enemy.x, enemy.y, p.color, 6, 2, 3);

    // Special effects
    if (p.special === 'splash') {
        const splashPx = p.splashRadius * tileSize;
        for (const e of enemies) {
            if (e === enemy || !e.alive) continue;
            if (dist(enemy.x, enemy.y, e.x, e.y) <= splashPx) {
                damageEnemy(e, Math.floor(p.damage * 0.5), p.tower);
                spawnParticles(e.x, e.y, '#ff6622', 3, 1.5, 2);
            }
        }
        // Splash visual
        spawnParticles(enemy.x, enemy.y, '#ff8844', 10, 3, 4);
    }

    if (p.special === 'slow') {
        enemy.slowTimer = 2.0;
        enemy.slowFactor = p.slowFactor || 0.5;
    }

    if (p.special === 'chain') {
        let chainTargets = [];
        const chainRange = 3 * tileSize;
        for (const e of enemies) {
            if (e === enemy || !e.alive) continue;
            if (dist(enemy.x, enemy.y, e.x, e.y) <= chainRange) {
                chainTargets.push(e);
            }
        }
        chainTargets.sort((a, b) => dist(enemy.x, enemy.y, a.x, a.y) - dist(enemy.x, enemy.y, b.x, b.y));
        const chainMax = p.chainCount || 3;
        let prevX = enemy.x, prevY = enemy.y;
        for (let c = 0; c < Math.min(chainMax, chainTargets.length); c++) {
            const ct = chainTargets[c];
            damageEnemy(ct, Math.floor(p.damage * 0.6), p.tower);
            // Lightning visual
            drawLightningBolt(prevX, prevY, ct.x, ct.y, p.color);
            spawnParticles(ct.x, ct.y, '#c49aff', 4, 2, 2);
            prevX = ct.x;
            prevY = ct.y;
        }
    }
}

function drawLightningBolt(x1, y1, x2, y2, color) {
    // Add as particle effect (draw for a few frames)
    const steps = 5;
    const dx = (x2 - x1) / steps;
    const dy = (y2 - y1) / steps;
    for (let i = 0; i < steps; i++) {
        const px = x1 + dx * i + (Math.random() - 0.5) * 10;
        const py = y1 + dy * i + (Math.random() - 0.5) * 10;
        particles.push({
            x: px, y: py, vx: 0, vy: 0,
            color, size: 3, life: 0.2, maxLife: 0.2,
        });
    }
}

function damageEnemy(enemy, damage, tower) {
    enemy.hp -= damage;
    if (tower) tower.totalDamage += damage;
    spawnFloatingText(enemy.x, enemy.y - enemy.radius * tileSize - 8, `-${damage}`, '#ff4d6a', 12);

    if (enemy.hp <= 0 && enemy.alive) {
        enemy.alive = false;
        gold += enemy.gold;
        score += enemy.gold;
        if (tower) tower.kills++;
        spawnParticles(enemy.x, enemy.y, enemy.color, 15, 3, 4);
        spawnFloatingText(enemy.x, enemy.y, `+${enemy.gold}g`, '#ffc857', 14);
    }
}

// ============ ENEMY MOVEMENT ============
function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (!enemy.alive) {
            enemies.splice(i, 1);
            continue;
        }

        // Slow effect
        if (enemy.slowTimer > 0) {
            enemy.slowTimer -= dt;
            enemy.speed = enemy.baseSpeed * enemy.slowFactor;
        } else {
            enemy.speed = enemy.baseSpeed;
        }

        const speed = enemy.speed * tileSize * dt;
        let remaining = speed;

        while (remaining > 0 && enemy.pathIndex < pixelPath.length - 1) {
            const target = pixelPath[enemy.pathIndex + 1];
            const dx = target.x - enemy.x;
            const dy = target.y - enemy.y;
            const d = Math.sqrt(dx * dx + dy * dy);

            if (d <= remaining) {
                enemy.x = target.x;
                enemy.y = target.y;
                remaining -= d;
                enemy.distTraveled += d;
                enemy.pathIndex++;
            } else {
                enemy.x += (dx / d) * remaining;
                enemy.y += (dy / d) * remaining;
                enemy.distTraveled += remaining;
                remaining = 0;
            }
        }

        // Reached end
        if (enemy.pathIndex >= pixelPath.length - 1) {
            enemy.alive = false;
            lives--;
            spawnFloatingText(enemy.x, enemy.y, '-1 ❤️', '#ff4d6a', 16);
            enemies.splice(i, 1);

            if (lives <= 0) {
                lives = 0;
                endGame(false);
            }
        }
    }
}

// ============ WAVE SPAWNING ============
function startWave() {
    if (waveActive || gameOver) return;
    if (currentWave >= WAVES.length) return;

    waveActive = true;
    const waveDef = WAVES[currentWave];
    waveQueue = [];

    let delay = 0;
    for (const group of waveDef) {
        for (let i = 0; i < group.count; i++) {
            waveQueue.push({ type: group.type, spawnAt: delay });
            delay += group.interval;
        }
    }

    waveSpawnTimer = 0;
    currentWave++;
    btnStartWave.disabled = true;
    btnStartWave.textContent = `Wave ${currentWave} in progress...`;
}

function updateWaveSpawning(dt) {
    if (!waveActive) return;
    waveSpawnTimer += dt;

    while (waveQueue.length > 0 && waveQueue[0].spawnAt <= waveSpawnTimer) {
        const spawn = waveQueue.shift();
        enemies.push(createEnemy(spawn.type));
    }

    // Wave complete?
    if (waveQueue.length === 0 && enemies.length === 0) {
        waveActive = false;
        if (currentWave >= WAVES.length) {
            endGame(true);
        } else {
            btnStartWave.disabled = false;
            btnStartWave.textContent = `▶ Start Wave ${currentWave + 1}`;
        }
    }
}

// ============ PARTICLES & TEXT UPDATE ============
function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function updateFloatingTexts(dt) {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y += ft.vy;
        ft.life -= dt;
        if (ft.life <= 0) floatingTexts.splice(i, 1);
    }
}

// ============ UI UPDATES ============
function updateUI() {
    goldDisplay.textContent = gold;
    livesDisplay.textContent = lives;
    waveDisplay.textContent = `${currentWave} / ${WAVES.length}`;
    scoreDisplay.textContent = score;

    // Tower card affordability
    for (const card of towerCards) {
        const type = card.dataset.tower;
        const def = TOWER_DEFS[type];
        if (gold < def.cost) {
            card.classList.add('disabled');
        } else {
            card.classList.remove('disabled');
        }
    }

    // Info panel for selected tower
    if (selectedPlacedTower) {
        const t = selectedPlacedTower;
        const def = TOWER_DEFS[t.type];
        const nextUpgrade = def.upgrades[t.level];
        let html = `<div class="tower-detail">`;
        html += `<div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${def.icon} ${def.name}</span></div>`;
        html += `<div class="detail-row"><span class="detail-label">Level</span><span class="detail-value">${t.level + 1} / 3</span></div>`;
        html += `<div class="detail-row"><span class="detail-label">Damage</span><span class="detail-value">${t.damage}</span></div>`;
        html += `<div class="detail-row"><span class="detail-label">Range</span><span class="detail-value">${t.range.toFixed(1)}</span></div>`;
        html += `<div class="detail-row"><span class="detail-label">Kills</span><span class="detail-value">${t.kills}</span></div>`;
        if (nextUpgrade) {
            html += `<div class="detail-row" style="margin-top:6px;"><span class="detail-label">Upgrade</span><span class="detail-value" style="color:#ffc857;">${nextUpgrade.cost}g</span></div>`;
            html += `<div style="margin-top:6px;"><button class="btn-primary" id="btn-upgrade" style="font-size:0.8rem;padding:8px;">⬆ Upgrade (${nextUpgrade.cost}g)</button></div>`;
        } else {
            html += `<div class="detail-row" style="margin-top:6px;"><span class="detail-label" style="color:#4ae08a;">MAX LEVEL</span></div>`;
        }
        html += `<div class="detail-row" style="margin-top:4px;"><span class="detail-label">Sell Value</span><span class="detail-value" style="color:#ff8844;">${getSellValue(t)}g</span></div>`;
        html += `</div>`;
        infoContent.innerHTML = html;

        // Bind upgrade button
        const btnUpgrade = document.getElementById('btn-upgrade');
        if (btnUpgrade) {
            btnUpgrade.addEventListener('click', () => upgradeTower(t));
        }
    }
}

function getSellValue(tower) {
    const def = TOWER_DEFS[tower.type];
    let total = def.cost;
    for (let i = 0; i < tower.level; i++) {
        total += def.upgrades[i].cost;
    }
    return Math.floor(total * 0.6);
}

function upgradeTower(tower) {
    const def = TOWER_DEFS[tower.type];
    const nextUpgrade = def.upgrades[tower.level];
    if (!nextUpgrade || gold < nextUpgrade.cost) return;

    gold -= nextUpgrade.cost;
    tower.level++;
    tower.damage = nextUpgrade.damage;
    tower.range = nextUpgrade.range;
    tower.fireRate = nextUpgrade.fireRate;

    spawnFloatingText(
        tower.gridX * tileSize + tileSize / 2,
        tower.gridY * tileSize,
        '⬆ Upgraded!', '#4ae08a', 14
    );
}

// ============ GAME END ============
function endGame(won) {
    gameOver = true;
    overlay.classList.remove('hidden');

    if (won) {
        overlayInner.className = 'overlay-content victory';
        overlayInner.innerHTML = `
            <h2>🏆 Victory!</h2>
            <p>You defended the realm through all ${WAVES.length} waves!<br>
            Final Score: <strong>${score}</strong></p>
            <button class="btn-primary" onclick="location.reload()">🔄 Play Again</button>
        `;
    } else {
        overlayInner.className = 'overlay-content defeat';
        overlayInner.innerHTML = `
            <h2>💀 Defeat</h2>
            <p>The enemies broke through your defenses.<br>
            You reached Wave ${currentWave} with a score of <strong>${score}</strong>.</p>
            <button class="btn-primary" onclick="location.reload()">🔄 Try Again</button>
        `;
    }
}

// ============ INPUT HANDLING ============
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    mouseGridX = Math.floor(mx / tileSize);
    mouseGridY = Math.floor(my / tileSize);
});

canvas.addEventListener('mouseleave', () => {
    mouseGridX = -1;
    mouseGridY = -1;
});

canvas.addEventListener('click', (e) => {
    if (gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const gx = Math.floor(mx / tileSize);
    const gy = Math.floor(my / tileSize);

    // Place tower
    if (selectedTowerType) {
        const def = TOWER_DEFS[selectedTowerType];
        if (gold < def.cost) return;
        if (pathTiles.has(`${gx},${gy}`)) return;
        if (towers.find(t => t.gridX === gx && t.gridY === gy)) return;
        if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;

        gold -= def.cost;
        const tower = createTower(selectedTowerType, gx, gy);
        towers.push(tower);
        spawnParticles(gx * tileSize + tileSize / 2, gy * tileSize + tileSize / 2, def.color, 10, 2, 3);
        spawnFloatingText(gx * tileSize + tileSize / 2, gy * tileSize, `-${def.cost}g`, '#ffc857', 12);

        // Deselect tower type
        selectedTowerType = null;
        towerCards.forEach(c => c.classList.remove('selected'));
        infoContent.innerHTML = '<p class="hint">Tower placed! Select another tower or click a placed tower for info.</p>';
        return;
    }

    // Select placed tower
    const clicked = towers.find(t => t.gridX === gx && t.gridY === gy);
    if (clicked) {
        selectedPlacedTower = clicked;
    } else {
        selectedPlacedTower = null;
        infoContent.innerHTML = '<p class="hint">Select a tower to place, then click on the map. Right-click to cancel.</p>';
    }
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    selectedTowerType = null;
    selectedPlacedTower = null;
    towerCards.forEach(c => c.classList.remove('selected'));
    infoContent.innerHTML = '<p class="hint">Select a tower to place, then click on the map. Right-click to cancel.</p>';
});

// Tower card selection
towerCards.forEach(card => {
    card.addEventListener('click', () => {
        const type = card.dataset.tower;
        const def = TOWER_DEFS[type];
        if (gold < def.cost) return;

        if (selectedTowerType === type) {
            selectedTowerType = null;
            card.classList.remove('selected');
        } else {
            selectedTowerType = type;
            selectedPlacedTower = null;
            towerCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            infoContent.innerHTML = `<p class="hint">Click on the map to place the <strong>${def.name}</strong> tower (${def.cost}g).</p>`;
        }
    });
});

// Start wave button
btnStartWave.addEventListener('click', startWave);

// Speed toggle
btnFast.addEventListener('click', () => {
    if (gameSpeed === 1) {
        gameSpeed = 2;
        btnFast.textContent = '⏩ 2x';
        btnFast.classList.add('active');
    } else if (gameSpeed === 2) {
        gameSpeed = 3;
        btnFast.textContent = '⏩ 3x';
    } else {
        gameSpeed = 1;
        btnFast.textContent = '⏩ 1x';
        btnFast.classList.remove('active');
    }
});

// Sell tower
btnSell.addEventListener('click', () => {
    if (!selectedPlacedTower) return;
    const val = getSellValue(selectedPlacedTower);
    gold += val;
    spawnFloatingText(
        selectedPlacedTower.gridX * tileSize + tileSize / 2,
        selectedPlacedTower.gridY * tileSize,
        `+${val}g`, '#ff8844', 14
    );
    towers = towers.filter(t => t !== selectedPlacedTower);
    selectedPlacedTower = null;
    infoContent.innerHTML = '<p class="hint">Tower sold!</p>';
});

// ============ GAME LOOP ============
let lastTime = 0;

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // Cap dt to prevent huge jumps
    if (dt > 0.1) dt = 0.1;

    dt *= gameSpeed;

    if (!gameOver) {
        updateWaveSpawning(dt);
        updateEnemies(dt);
        updateTowers(dt);
        updateProjectiles(dt);
        updateParticles(dt);
        updateFloatingTexts(dt);
        updateUI();
    }

    // Draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawHoverTile();
    drawTowers();
    drawEnemies();
    drawProjectiles();
    drawParticles();
    drawFloatingTexts();

    requestAnimationFrame(gameLoop);
}

// ============ INIT ============
function init() {
    resize();
    btnStartWave.textContent = '▶ Start Wave 1';
    requestAnimationFrame(gameLoop);
}

init();

})();
