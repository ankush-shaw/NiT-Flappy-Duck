const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const hud = document.getElementById('hud');
const currentScoreEl = document.getElementById('current-score');
const finalScoreEl = document.getElementById('final-score');
const bestScoreEl = document.getElementById('best-score');
const hudBestScoreEl = document.getElementById('hud-best-score');
const startBestScoreEl = document.getElementById('start-best-score');
const startBtn = document.getElementById('start-button');
const restartBtn = document.getElementById('restart-button');

const birdImg = document.getElementById('bird-img');
const bgImg = document.getElementById('bg-img');
const pipeImg = document.getElementById('pipe-img');

// Sound assets
const jumpSound = new Audio('./assets/anime-ahh.mp3');
const deathSound = new Audio('./assets/faaaa.mp3');
const bgMusic = new Audio('./assets/bcg.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.3; // Set volume to 30% so it doesn't overpower sound effects

// Game constants
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;
const GRAVITY = 0.1;
const JUMP = -3.5;
const PIPE_WIDTH = 60;

// Dynamic constants based on device
const isMobile = window.innerWidth <= 600;

// On mobile, we increase the gap and spacing to make it playable
const PIPE_GAP = isMobile ? 240 : 180; // Significantly reduced vertical gap (Harder!)
const MOBILE_SPAWN_MULTIPLIER = 1.2; // 20% more horizontal distance on mobile

// Progressive difficulty settings
const BASE_PIPE_SPEED = 2.2; // Increased again (Even faster!)
const MAX_PIPE_SPEED = 4.5;  // Higher max speed
const SPEED_INCREMENT = 0.08;

// Spacing: Increase horizontal distance for mobile
// Adjusted spawn rates again for the new higher speed
const BASE_SPAWN_RATE = isMobile ? 2200 : 1300; // Increased spawn time for mobile = More distance
const MIN_SPAWN_RATE = isMobile ? 1200 : 700;
const SPAWN_RATE_DECREMENT = 25;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

let bird = {
    x: 70,
    y: 300,
    width: 100,  // Reduced from 90
    height: 120, // Reduced from 120 (maintaining aspect ratio)
    velocity: 0,
    rotation: 0
};

let pipes = [];
let score = 0;
let bestScore = localStorage.getItem('flappyBestScore') || 0;
let gameActive = false;
let lastPipeTime = 0;
let animationId;

// Dynamic game speed variables
let currentPipeSpeed = BASE_PIPE_SPEED;
let currentSpawnRate = BASE_SPAWN_RATE;

// Image loading check
let imagesLoaded = 0;
const totalImages = 3;

function imageLoaded() {
    imagesLoaded++;
    console.log(`Image loaded (${imagesLoaded}/${totalImages})`);
    if (imagesLoaded === totalImages) {
        console.log('All images loaded successfully');
        draw();
    }
}

// Check if already loaded or attach listener
[birdImg, bgImg, pipeImg].forEach(img => {
    if (img.complete) {
        imageLoaded();
    } else {
        img.onload = imageLoaded;
        img.onerror = () => console.error(`Failed to load: ${img.src}`);
    }
});

function init() {
    bird.y = 300;
    bird.velocity = 0;
    bird.rotation = 0;
    pipes = [];
    score = 0;
    currentScoreEl.textContent = '0';
    lastPipeTime = 0;

    // Reset speed to starting values
    currentPipeSpeed = BASE_PIPE_SPEED;
    currentSpawnRate = BASE_SPAWN_RATE;
}

function spawnPipe() {
    const minPipeHeight = 50;
    const maxPipeHeight = CANVAS_HEIGHT - PIPE_GAP - minPipeHeight;
    const height = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1)) + minPipeHeight;

    pipes.push({
        x: CANVAS_WIDTH,
        topHeight: height,
        passed: false
    });
}

function update(timestamp) {
    if (!gameActive) return;

    // Bird physics
    bird.velocity += GRAVITY;
    bird.y += bird.velocity;
    bird.rotation = Math.min(Math.PI / 3, Math.max(-Math.PI / 3, bird.velocity * 0.15));

    // Pipe generation (dynamic spawn rate)
    if (timestamp - lastPipeTime > currentSpawnRate) {
        spawnPipe();
        lastPipeTime = timestamp;
    }

    // Update pipes (dynamic speed)
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= currentPipeSpeed;

        // Collision detection (accurate hitbox matching visual pipe body)
        const birdHitboxWidth = bird.width * 0.5;
        const birdHitboxHeight = bird.height * 0.5;
        const birdHitboxX = bird.x + (bird.width - birdHitboxWidth) / 2;
        const birdHitboxY = bird.y + (bird.height - birdHitboxHeight) / 2;

        // Pipe has decorative rims (~35px) at the opening that shouldn't count for collision
        const rimHeight = 35;

        // Horizontal hitbox: reduce by 8px on each side for more forgiving gameplay
        const pipeHitboxPadding = 8;
        const pipeHitboxLeft = pipes[i].x + pipeHitboxPadding;
        const pipeHitboxRight = pipes[i].x + PIPE_WIDTH - pipeHitboxPadding;

        // Vertical hitbox: exclude the decorative rims
        const topPipeBottom = pipes[i].topHeight - rimHeight;
        const bottomPipeTop = pipes[i].topHeight + PIPE_GAP + rimHeight;

        if (pipeHitboxLeft < bird.x + birdHitboxWidth &&
            pipeHitboxRight > birdHitboxX) {
            // Check collision with actual pipe body (excluding rims)
            if (birdHitboxY < topPipeBottom ||
                birdHitboxY + birdHitboxHeight > bottomPipeTop) {
                gameOver();
                return;
            }
        }

        // Score (with progressive difficulty)
        if (!pipes[i].passed && pipes[i].x + PIPE_WIDTH < bird.x) {
            pipes[i].passed = true;
            score++;
            currentScoreEl.textContent = score;

            // Increase difficulty progressively
            currentPipeSpeed = Math.min(MAX_PIPE_SPEED, BASE_PIPE_SPEED + (score * SPEED_INCREMENT));
            currentSpawnRate = Math.max(MIN_SPAWN_RATE, BASE_SPAWN_RATE - (score * SPAWN_RATE_DECREMENT));
        }

        // Remove off-screen pipes
        if (pipes[i].x + PIPE_WIDTH < -20) {
            pipes.splice(i, 1);
        }
    }

    // Boundary collisions (top and bottom) with safe padding for mobile
    const boundaryPadding = 10; // Safe zone to account for mobile scaling
    if (bird.y < -boundaryPadding || bird.y + bird.height > CANVAS_HEIGHT + boundaryPadding) {
        gameOver();
    }

    draw();
    animationId = requestAnimationFrame(update);
}

function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Background
    if (imagesLoaded >= totalImages) {
        ctx.drawImage(bgImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
        // Fallback gradient background
        const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        grad.addColorStop(0, '#4facfe');
        grad.addColorStop(1, '#00f2fe');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Draw Pipes
    if (imagesLoaded >= totalImages) {
        for (let pipe of pipes) {
            // Draw top pipe (flipped)
            ctx.save();
            ctx.translate(pipe.x + PIPE_WIDTH / 2, pipe.topHeight);
            ctx.scale(1, -1);
            ctx.drawImage(pipeImg, -PIPE_WIDTH / 2, 0, PIPE_WIDTH, pipe.topHeight);
            ctx.restore();

            // Draw bottom pipe
            const bottomPipeHeight = CANVAS_HEIGHT - pipe.topHeight - PIPE_GAP;
            ctx.drawImage(pipeImg, pipe.x, pipe.topHeight + PIPE_GAP, PIPE_WIDTH, bottomPipeHeight);
        }
    }

    // Draw Bird
    ctx.save();
    ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
    ctx.scale(-1, 1);
    ctx.rotate(bird.rotation);
    if (imagesLoaded >= totalImages) {
        ctx.drawImage(birdImg, -bird.width / 2, -bird.height / 2, bird.width, bird.height);
    } else {
        // Fallback bird
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(0, 0, bird.width / 2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function gameOver() {
    gameActive = false;
    cancelAnimationFrame(animationId);

    // Stop background music
    bgMusic.pause();
    bgMusic.currentTime = 0;

    // UI Feedback: Screen Shake
    const container = document.getElementById('game-container');
    container.classList.add('shake');
    setTimeout(() => container.classList.remove('shake'), 400);

    deathSound.currentTime = 0;
    deathSound.play().catch(e => console.log('Death sound blocked:', e));

    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('flappyBestScore', bestScore);
    }

    finalScoreEl.textContent = score;
    bestScoreEl.textContent = bestScore;
    startBestScoreEl.textContent = bestScore;

    gameOverScreen.classList.remove('hidden');
    hud.classList.add('hidden');
}

function startGame() {
    init();
    gameActive = true;
    hudBestScoreEl.textContent = `Best: ${bestScore}`;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');

    // Start background music
    bgMusic.currentTime = 0;
    bgMusic.play().catch(e => console.log('Background music play blocked:', e));

    requestAnimationFrame(update);
}

// Controls
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (gameActive) {
            bird.velocity = JUMP;
            jumpSound.currentTime = 0; // Reset sound if playing
            jumpSound.play().catch(e => console.log('Sound play blocked:', e));
        } else if (!startScreen.classList.contains('hidden') || !gameOverScreen.classList.contains('hidden')) {
            startGame();
        }
    }
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameActive) {
        bird.velocity = JUMP;
        jumpSound.currentTime = 0;
        jumpSound.play().catch(e => console.log('Sound play blocked:', e));
    } else if (!startScreen.classList.contains('hidden') || !gameOverScreen.classList.contains('hidden')) {
        startGame();
    }
});

canvas.addEventListener('mousedown', (e) => {
    if (gameActive) {
        bird.velocity = JUMP;
        jumpSound.currentTime = 0;
        jumpSound.play().catch(e => console.log('Sound play blocked:', e));
    }
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Initial draw call
draw();
startBestScoreEl.textContent = bestScore;
