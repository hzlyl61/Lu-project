// 获取画布和上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 设置画布大小
const CANVAS_SIZE = 400;
canvas.width = CANVAS_SIZE;
canvas.height = CANVAS_SIZE;

// 游戏配置
const GRID_SIZE = 20;
const TILE_COUNT = CANVAS_SIZE / GRID_SIZE;
const INITIAL_SPEED = 200; // 初始速度（毫秒）

// 游戏状态
let snake = [];
let food = {};
let dx = 0;
let dy = 0;
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let gameLoop = null;
let isPaused = false;
let gameStarted = false;
let currentSpeed = INITIAL_SPEED;
let lastMilestone = 0; // 记录上一个达到的里程碑

// 音效对象 - 使用 Web Audio API 生成音效
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// 背景音乐控制
let bgMusicOscillator = null;
let bgMusicGain = null;
let isMusicPlaying = false;
let musicEnabled = localStorage.getItem('musicEnabled') !== 'false'; // 默认开启

function playEatSound() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

function playBonusSound() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'square';
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);

    // 播放上升的音符序列
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.1);
    });

    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
}

function playGameOverSound() {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.5);

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

// 背景音乐 - 简单的循环旋律
function startBackgroundMusic() {
    if (!musicEnabled || isMusicPlaying) return;

    // 创建增益节点控制音量
    bgMusicGain = audioContext.createGain();
    bgMusicGain.gain.value = 0.08; // 设置较低的背景音乐音量
    bgMusicGain.connect(audioContext.destination);

    // 播放循环旋律
    playMusicLoop();
    isMusicPlaying = true;
}

function playMusicLoop() {
    if (!musicEnabled || !isMusicPlaying) return;

    // C大调五声音阶的简单旋律
    const melody = [
        { freq: 523.25, duration: 0.3 }, // C5
        { freq: 587.33, duration: 0.3 }, // D5
        { freq: 659.25, duration: 0.3 }, // E5
        { freq: 783.99, duration: 0.3 }, // G5
        { freq: 880.00, duration: 0.3 }, // A5
        { freq: 783.99, duration: 0.3 }, // G5
        { freq: 659.25, duration: 0.3 }, // E5
        { freq: 587.33, duration: 0.6 }, // D5
    ];

    let time = audioContext.currentTime;

    melody.forEach((note, index) => {
        const osc = audioContext.createOscillator();
        const noteGain = audioContext.createGain();

        osc.connect(noteGain);
        noteGain.connect(bgMusicGain);

        osc.type = 'triangle';
        osc.frequency.value = note.freq;

        // 音符包络
        noteGain.gain.setValueAtTime(0, time);
        noteGain.gain.linearRampToValueAtTime(0.5, time + 0.05);
        noteGain.gain.linearRampToValueAtTime(0.3, time + note.duration - 0.05);
        noteGain.gain.linearRampToValueAtTime(0, time + note.duration);

        osc.start(time);
        osc.stop(time + note.duration);

        time += note.duration;
    });

    // 计算总时长并设置下一次循环
    const totalDuration = melody.reduce((sum, note) => sum + note.duration, 0);
    setTimeout(() => {
        if (musicEnabled && isMusicPlaying) {
            playMusicLoop();
        }
    }, totalDuration * 1000);
}

function stopBackgroundMusic() {
    isMusicPlaying = false;
    if (bgMusicGain) {
        bgMusicGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
    }
}

function toggleBackgroundMusic() {
    musicEnabled = !musicEnabled;
    localStorage.setItem('musicEnabled', musicEnabled);

    const musicBtn = document.getElementById('musicBtn');
    if (musicEnabled) {
        musicBtn.textContent = '🔊 音乐';
        if (gameStarted) {
            startBackgroundMusic();
        }
    } else {
        musicBtn.textContent = '🔇 音乐';
        stopBackgroundMusic();
    }
}

// 获取DOM元素
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('highScore');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');

// 初始化最高分显示
highScoreElement.textContent = highScore;

// 初始化游戏
function initGame() {
    // 初始化蛇的位置（中心位置）
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];

    // 初始化移动方向（向右）
    dx = 1;
    dy = 0;

    // 重置分数
    score = 0;
    scoreElement.textContent = score;

    // 重置速度和里程碑
    currentSpeed = INITIAL_SPEED;
    lastMilestone = 0;

    // 生成食物
    generateFood();

    // 重置游戏状态
    isPaused = false;
    gameStarted = true;

    // 更新按钮状态
    startBtn.disabled = true;
    pauseBtn.disabled = false;
}

// 生成食物
function generateFood() {
    let foodValid = false;

    while (!foodValid) {
        food = {
            x: Math.floor(Math.random() * TILE_COUNT),
            y: Math.floor(Math.random() * TILE_COUNT)
        };

        // 确保食物不在蛇身上
        foodValid = !snake.some(segment =>
            segment.x === food.x && segment.y === food.y
        );
    }
}

// 绘制游戏
function draw() {
    // 清空画布
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 绘制网格线（可选）
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= TILE_COUNT; i++) {
        ctx.beginPath();
        ctx.moveTo(i * GRID_SIZE, 0);
        ctx.lineTo(i * GRID_SIZE, CANVAS_SIZE);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * GRID_SIZE);
        ctx.lineTo(CANVAS_SIZE, i * GRID_SIZE);
        ctx.stroke();
    }

    // 绘制蛇 - 七彩颜色
    snake.forEach((segment, index) => {
        // 彩虹色数组
        const rainbowColors = [
            '#FF0000', // 红
            '#FF7F00', // 橙
            '#FFFF00', // 黄
            '#00FF00', // 绿
            '#00FFFF', // 青
            '#0000FF', // 蓝
            '#8B00FF'  // 紫
        ];

        // 根据索引选择颜色，循环使用彩虹色
        const colorIndex = index % rainbowColors.length;
        ctx.fillStyle = rainbowColors[colorIndex];

        ctx.fillRect(
            segment.x * GRID_SIZE + 1,
            segment.y * GRID_SIZE + 1,
            GRID_SIZE - 2,
            GRID_SIZE - 2
        );

        // 添加光泽效果 - 所有节都有光泽
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(
            segment.x * GRID_SIZE + 2,
            segment.y * GRID_SIZE + 2,
            GRID_SIZE / 2,
            GRID_SIZE / 2
        );
    });

    // 绘制食物
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(
        food.x * GRID_SIZE + GRID_SIZE / 2,
        food.y * GRID_SIZE + GRID_SIZE / 2,
        GRID_SIZE / 2 - 2,
        0,
        Math.PI * 2
    );
    ctx.fill();

    // 食物高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(
        food.x * GRID_SIZE + GRID_SIZE / 2 - 3,
        food.y * GRID_SIZE + GRID_SIZE / 2 - 3,
        3,
        0,
        Math.PI * 2
    );
    ctx.fill();
}

// 更新游戏状态
function update() {
    if (isPaused || !gameStarted) return;

    // 计算新的蛇头位置
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // 检查碰撞 - 墙壁
    if (head.x < 0 || head.x >= TILE_COUNT ||
        head.y < 0 || head.y >= TILE_COUNT) {
        gameOver();
        return;
    }

    // 检查碰撞 - 自己
    if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        gameOver();
        return;
    }

    // 添加新的蛇头
    snake.unshift(head);

    // 检查是否吃到食物
    if (head.x === food.x && head.y === food.y) {
        const oldScore = score;
        score += 10;
        scoreElement.textContent = score;

        // 播放吃食物音效
        playEatSound();

        // 检查是否达到100分的倍数（里程碑）
        const currentMilestone = Math.floor(score / 100);
        if (currentMilestone > lastMilestone) {
            lastMilestone = currentMilestone;

            // 播放奖励音效
            playBonusSound();

            // 加速游戏（速度提升10%）
            currentSpeed = Math.max(50, currentSpeed * 0.9);

            // 重新设置游戏循环速度
            clearInterval(gameLoop);
            gameLoop = setInterval(update, currentSpeed);

            // 显示奖励提示
            showBonusMessage();
        }

        // 更新最高分
        if (score > highScore) {
            highScore = score;
            highScoreElement.textContent = highScore;
            localStorage.setItem('snakeHighScore', highScore);
        }

        // 生成新食物
        generateFood();
    } else {
        // 如果没吃到食物，移除蛇尾
        snake.pop();
    }

    // 重绘
    draw();
}

// 显示奖励提示
function showBonusMessage() {
    // 在画布上显示奖励消息
    const originalComposite = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;

    const message = `🎉 ${score}分奖励! 速度提升! 🎉`;

    ctx.strokeText(message, CANVAS_SIZE / 2, CANVAS_SIZE / 2);
    ctx.fillText(message, CANVAS_SIZE / 2, CANVAS_SIZE / 2);
    ctx.restore();

    ctx.globalCompositeOperation = originalComposite;

    // 2秒后消息消失（通过重绘实现）
    setTimeout(() => {
        if (gameStarted) draw();
    }, 2000);
}

// 游戏结束
function gameOver() {
    clearInterval(gameLoop);
    gameStarted = false;

    // 停止背景音乐
    stopBackgroundMusic();

    // 播放游戏结束音效
    playGameOverSound();

    // 显示游戏结束信息
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('游戏结束!', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 20);

    ctx.font = '20px Arial';
    ctx.fillText(`得分: ${score}`, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 20);

    // 更新按钮状态
    startBtn.disabled = false;
    pauseBtn.disabled = true;
}

// 开始游戏
function startGame() {
    if (gameLoop) {
        clearInterval(gameLoop);
    }

    initGame();
    draw();

    // 启动背景音乐
    if (musicEnabled) {
        startBackgroundMusic();
    }

    gameLoop = setInterval(update, currentSpeed);
}

// 暂停/继续游戏
function togglePause() {
    if (!gameStarted) return;

    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? '继续' : '暂停';
}

// 重置游戏
function resetGame() {
    if (gameLoop) {
        clearInterval(gameLoop);
    }

    // 停止背景音乐
    stopBackgroundMusic();

    gameStarted = false;
    isPaused = false;
    pauseBtn.textContent = '暂停';

    // 重置显示
    initGame();
    draw();
    clearInterval(gameLoop);

    // 更新按钮状态
    startBtn.disabled = false;
    pauseBtn.disabled = true;
}

// 键盘控制
document.addEventListener('keydown', (e) => {
    if (!gameStarted) return;

    switch(e.key) {
        case 'ArrowUp':
            if (dy === 0) { // 防止反向移动
                dx = 0;
                dy = -1;
            }
            e.preventDefault();
            break;
        case 'ArrowDown':
            if (dy === 0) {
                dx = 0;
                dy = 1;
            }
            e.preventDefault();
            break;
        case 'ArrowLeft':
            if (dx === 0) {
                dx = -1;
                dy = 0;
            }
            e.preventDefault();
            break;
        case 'ArrowRight':
            if (dx === 0) {
                dx = 1;
                dy = 0;
            }
            e.preventDefault();
            break;
        case ' ':
            togglePause();
            e.preventDefault();
            break;
    }
});

// 按钮事件
startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);
resetBtn.addEventListener('click', resetGame);

// 音乐按钮事件（延迟绑定，等DOM加载）
window.addEventListener('DOMContentLoaded', () => {
    const musicBtn = document.getElementById('musicBtn');
    if (musicBtn) {
        musicBtn.textContent = musicEnabled ? '🔊 音乐' : '🔇 音乐';
        musicBtn.addEventListener('click', toggleBackgroundMusic);
    }
});

// 初始绘制
initGame();
draw();
clearInterval(gameLoop);
startBtn.disabled = false;
pauseBtn.disabled = true;
gameStarted = false;
