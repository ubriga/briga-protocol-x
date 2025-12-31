/** 
 * BRIGA PROTOCOL X - GAME LOGIC v8.0
 * Secure Client-Side Engine
 */

const API = "https://ubriga.pythonanywhere.com"; // שנה לכתובת השרת האמיתית
let TOKEN = localStorage.getItem('px_token');
let USER = null;

// --- AUTH SYSTEM ---
const auth = {
    login: async () => {
        const u = document.getElementById('login-u').value;
        const p = document.getElementById('login-p').value;
        if(!u || !p) return alert("Please enter ID and Passcode");
        
        try {
            const res = await fetch(`${API}/login`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username: u, password: p})
            });
            const data = await res.json();
            
            if (data.error) return alert(data.error);
            
            TOKEN = data.token;
            localStorage.setItem('px_token', TOKEN);
            USER = data.user;
            
            // System Message Logic
            if (data.motd && data.motd.enabled) {
                const lastSeen = localStorage.getItem('last_motd_id');
                if(lastSeen != data.motd.id) {
                    document.getElementById('motd-title').innerText = data.motd.title;
                    document.getElementById('motd-msg').innerText = data.motd.message;
                    document.getElementById('motd-modal').style.display = 'block';
                    localStorage.setItem('last_motd_id', data.motd.id);
                    
                    if (data.motd.duration > 0) {
                        setTimeout(() => document.getElementById('motd-modal').style.display='none', data.motd.duration * 1000);
                    }
                }
            }
            
            ui.toLobby();
        } catch(e) { alert("Connection Error: Server Offline?"); }
    },
    
    register: async () => {
        const u = document.getElementById('reg-u').value;
        const p = document.getElementById('reg-p').value;
        if(!u || !p) return alert("Fill all fields");
        
        await fetch(`${API}/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: u, password: p})
        });
        alert("Registration Successful. Please Login.");
        auth.toggle('login');
    },

    toggle: (mode) => {
        document.getElementById('reg-box').style.display = mode === 'register' ? 'block' : 'none';
    },
    
    logout: () => {
        TOKEN = null; localStorage.removeItem('px_token'); location.reload();
    }
};

// --- UI MANAGER ---
const ui = {
    toLobby: () => {
        document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
        document.getElementById('screen-lobby').style.display = 'flex';
        document.getElementById('hud').style.display = 'none';
        
        document.getElementById('u-name').innerText = USER.display_name.toUpperCase();
        document.getElementById('u-credits').innerText = USER.credits.toLocaleString();
        
        if (USER.is_admin) document.getElementById('admin-controls').style.display = 'block';
        
        shop.load();
        ui.loadLeaderboard();
    },
    
    tab: (name) => {
        ['ops', 'armory', 'leaders'].forEach(t => document.getElementById(`tab-${t}`).style.display = 'none');
        document.getElementById(`tab-${name}`).style.display = name === 'ops' ? 'flex' : 'block';
    },

    loadLeaderboard: async () => {
        const res = await fetch(`${API}/leaderboard`);
        const data = await res.json();
        const tbody = document.getElementById('lb-body');
        tbody.innerHTML = data.map((r, i) => `
            <tr style="border-bottom: 1px solid #222;">
                <td style="color:#666; padding: 10px;">#${i+1}</td>
                <td style="color:white;">${r.player}</td>
                <td style="color:var(--main); font-weight:bold;">${r.score.toLocaleString()}</td>
                <td style="color:#aaa;">${r.wave} <span style="font-size:10px;">(${r.difficulty || 'N/A'})</span></td>
            </tr>
        `).join('');
    }
};

// --- SHOP SYSTEM ---
const shop = {
    items: [],
    load: async () => {
        const res = await fetch(`${API}/shop/items`);
        shop.items = await res.json();
        shop.render();
    },
    
    render: () => {
        const container = document.getElementById('shop-container');
        container.innerHTML = shop.items.map(item => {
            const userLvl = USER.inventory[item.id] || 0;
            const price = item.base_price + (userLvl * item.step_price);
            
            // Check ownership
            let btnText = `BUY ${price.toLocaleString()}`;
            let btnClass = "";
            let disabled = "";
            
            if (item.type === 'skin' && USER.inventory[item.id]) {
                btnText = "OWNED"; disabled = "disabled";
            } else if (USER.credits < price) {
                btnClass = "disabled"; disabled = "disabled";
            }
            
            return `
            <div class="shop-item">
                <div class="icon">${item.icon}</div>
                <div class="name">${item.name}</div>
                <div class="desc">${item.description}</div>
                <div style="display:flex; justify-content:space-between; width:100%; margin-top:auto; align-items:center;">
                    <div style="font-size:10px; color:#555;">LVL: ${userLvl}</div>
                    <button onclick="shop.buy('${item.id}')" class="${btnClass}" ${disabled} style="font-size:10px; padding:5px 10px;">${btnText}</button>
                </div>
            </div>`;
        }).join('');
    },
    
    buy: async (id) => {
        const res = await fetch(`${API}/shop/buy`, {
            method: 'POST',
            headers: {'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json'},
            body: JSON.stringify({item_id: id})
        });
        const data = await res.json();
        
        if (data.new_credits !== undefined) {
            USER.credits = data.new_credits;
            
            // Optimistic Client Update
            if(!USER.inventory[id]) USER.inventory[id] = 0;
            const item = shop.items.find(i=>i.id===id);
            if(item.type !== 'skin') USER.inventory[id]++;
            else USER.inventory[id] = true;
            
            document.getElementById('u-credits').innerText = USER.credits.toLocaleString();
            shop.render();
        } else {
            alert(data.error);
        }
    }
};

// --- ADMIN SYSTEM ---
const admin = {
    resetLeaderboard: async () => {
        if(!confirm("⚠️ WARNING: This will delete ALL scores. Proceed?")) return;
        
        const res = await fetch(`${API}/admin/action`, {
            method: 'POST',
            headers: {'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'reset_leaderboard'})
        });
        const d = await res.json();
        alert(d.message);
        ui.loadLeaderboard();
    },
    
    msgMenu: async () => {
        const msg = prompt("Enter the message for all players:");
        if(!msg) return;
        
        const title = prompt("Enter title (Default: SYSTEM ALERT):") || "SYSTEM ALERT";
        const duration = prompt("Duration in seconds (0 for infinite):") || 5;
        
        const res = await fetch(`${API}/admin/action`, {
            method: 'POST',
            headers: {'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: 'set_motd', 
                message: msg, 
                title: title, 
                duration: duration
            })
        });
        const d = await res.json();
        alert(d.message);
    }
};

// --- GAME ENGINE ---
const game = {
    canvas: document.getElementById('gameCanvas'),
    ctx: document.getElementById('gameCanvas').getContext('2d'),
    sessionId: null,
    running: false,
    player: {x:0, y:0, hp:100, maxHp:100, heat:0, score:0},
    bullets: [], enemies: [], particles: [],
    KEYS: {},
    
    init: () => {
        window.addEventListener('keydown', e => game.KEYS[e.code] = true);
        window.addEventListener('keyup', e => game.KEYS[e.code] = false);
        game.canvas.width = window.innerWidth;
        game.canvas.height = window.innerHeight;
    },
    
    start: async () => {
        try {
            const diff = document.getElementById('diff-select').value;
            const res = await fetch(`${API}/game/start`, {
                method: 'POST',
                headers: {'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json'},
                body: JSON.stringify({difficulty: diff}) // Send difficulty
            });
            const data = await res.json();
            
            game.sessionId = data.session_id;
            game.stats = data.stats;
            game.difficulty = diff;
            
            // Init Player
            game.player.maxHp = data.stats.max_hp;
            game.player.hp = game.player.maxHp;
            game.player.x = game.canvas.width / 2;
            game.player.y = game.canvas.height - 100;
            game.player.score = 0;
            game.wave = 1;
            
            game.bullets = [];
            game.enemies = [];
            
            game.running = true;
            document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
            document.getElementById('hud').style.display = 'block';
            
            game.spawnWave();
            game.loop();
            
        } catch(e) { console.error(e); alert("Failed to start session"); }
    },
    
    spawnWave: () => {
        for(let i=0; i<5 + game.wave; i++) {
            game.enemies.push({
                x: Math.random() * game.canvas.width,
                y: -Math.random() * 500,
                hp: 20 + (game.wave * 5),
                speed: 2 + Math.random()
            });
        }
    },
    
    shoot: async () => {
        if(game.player.heat >= 100) return;
        
        // Visual (Immediate)
        game.bullets.push({x: game.player.x, y: game.player.y});
        
        // Server Validation
        const res = await fetch(`${API}/game/shoot`, {
            method: 'POST',
            headers: {'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json'},
            body: JSON.stringify({
                session_id: game.sessionId, 
                auto_fire: document.getElementById('chk-autofire').checked
            })
        });
        const d = await res.json();
        
        if(d.heat_gain) {
            game.player.heat = Math.min(100, game.player.heat + d.heat_gain);
        }
    },
    
    end: async () => {
        game.running = false;
        const res = await fetch(`${API}/game/end`, {
            method: 'POST',
            headers: {'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json'},
            body: JSON.stringify({
                session_id: game.sessionId,
                score: game.player.score,
                wave: game.wave,
                difficulty: game.difficulty
            })
        });
        const data = await res.json();
        
        document.getElementById('screen-over').style.display = 'flex';
        document.getElementById('final-score').innerText = game.player.score.toLocaleString();
        document.getElementById('final-wave').innerText = `WAVE ${game.wave}`;
        
        if(data.error) alert("CHEAT DETECTED: Score Rejected");
        else USER.credits += data.earned; 
    },
    
    loop: () => {
        if (!game.running) return;
        requestAnimationFrame(game.loop);
        
        const ctx = game.ctx;
        ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);
        
        // --- LOGIC ---
        // Player Movement
        if(game.KEYS['ArrowLeft']) game.player.x -= 8;
        if(game.KEYS['ArrowRight']) game.player.x += 8;
        
        // Cooling
        game.player.heat = Math.max(0, game.player.heat - 0.2);
        
        // Auto Fire
        if(document.getElementById('chk-autofire').checked && game.player.heat < 100) {
            if(Date.now() % 200 < 20) game.shoot(); // Simplified timing
        } else if (game.KEYS['Space']) {
             // Manual fire debounce logic needed here
             if(!game.lastShot || Date.now() - game.lastShot > 200) {
                 game.shoot();
                 game.lastShot = Date.now();
             }
        }

        // Bullets
        game.bullets.forEach((b, i) => {
            b.y -= 10;
            ctx.fillStyle = "#00ffcc";
            ctx.fillRect(b.x-2, b.y, 4, 10);
            if(b.y < 0) game.bullets.splice(i, 1);
        });
        
        // Enemies
        game.enemies.forEach((e, i) => {
            e.y += e.speed;
            ctx.fillStyle = "red";
            ctx.fillRect(e.x-15, e.y-15, 30, 30);
            
            // Collision Bullet
            game.bullets.forEach((b, bi) => {
                if(Math.abs(b.x - e.x) < 20 && Math.abs(b.y - e.y) < 20) {
                    e.hp -= 10; // Temp dmg
                    game.bullets.splice(bi, 1);
                    if(e.hp <= 0) {
                        game.enemies.splice(i, 1);
                        game.player.score += 100;
                    }
                }
            });
            
            // Collision Player
            if(Math.abs(game.player.x - e.x) < 30 && Math.abs(game.player.y - e.y) < 30) {
                game.player.hp -= 10;
                game.enemies.splice(i, 1);
            }
        });
        
        // --- DRAW HUD ---
        document.getElementById('bar-hp').style.width = (game.player.hp/game.player.maxHp * 100) + "%";
        document.getElementById('bar-heat').style.width = game.player.heat + "%";
        document.getElementById('score-disp').innerText = game.player.score;
        
        // Draw Player
        ctx.fillStyle = USER.inventory['skin_gold'] ? 'gold' : '#00ffcc';
        ctx.beginPath(); ctx.moveTo(game.player.x, game.player.y-20);
        ctx.lineTo(game.player.x-15, game.player.y+15);
        ctx.lineTo(game.player.x+15, game.player.y+15);
        ctx.fill();
        
        if (game.enemies.length === 0) {
            game.wave++;
            game.spawnWave();
        }
        
        if (game.player.hp <= 0) game.end();
    }
};

// Start
game.init();
