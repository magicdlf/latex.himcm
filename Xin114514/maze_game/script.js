// 游戏配置常量
const CONFIG = {
    MAP_SIZE: 256,
    CELL_SIZE: 4,  // 每个格子的像素大小 (从2增加到4，地图会变成1024x1024)
    NUM_ALTARS: 10,
    NUM_PURSUERS: 20,
    NUM_TARGETS: 4,
    
    // 实体尺寸
    BASE_SIZE: 3,         // 基地: 3x3
    PURSUER_SIZE: 2,      // 追兵: 2x2
    ALTAR_SIZE: 1,        // 祭坛: 1x1
    TARGET_SIZE: 1,       // 目标点: 1x1
    
    // 移动速度 (毫秒/格)
    BASE_SPEED: 10,      // 基地: 4格/秒
    PURSUER_SPEED: 16,   // 追兵: 6格/秒 (1000/6 ≈ 166ms)
    
    // 伤害设置
    BASE_HP: 500,
    PURSUER_DAMAGE: 5,
    PURSUER_ATTACK_INTERVAL: 1500,  // 1.5秒
    PURSUER_ATTACK_INTERVAL_FAST: 1000,  // 周围有人时1秒
    ALTAR_DAMAGE_INTERVAL: 5000,    // 5秒
    
    // 范围设置
    PURSUER_ATTACK_RANGE: 5,        // 追兵攻击范围
    PURSUER_DETECTION_RANGE: 8,     // 追兵检测其他追兵的范围
    ALTAR_DAMAGE_RANGE: 10,
    
    // 碾压设置
    CRUSH_TIME: 500,               // 碾压时间：1秒
    CRUSH_DETECTION_RANGE: 2,       // 碾压检测范围
    
    // 冲击波设置
    SHOCKWAVE_INTERVAL: 5000,       // 冲击波间隔：5秒
    SHOCKWAVE_RANGE: 5,             // 冲击波范围：5x5
    SHOCKWAVE_ANIMATION_TIME: 500,  // 冲击波动画时间：0.5秒
    SHOCKWAVE_MAX_KILLS: 5,         // 冲击波最大击杀数量
    
    // 迷宫生成设置
    MIN_CORRIDOR_WIDTH: 6,          // 最小通道宽度，确保4x4基地能通过
    PURSUER_CORRIDOR_WIDTH: 4,      // 追兵通道宽度，确保3x3追兵能通过
    MAIN_CORRIDOR_WIDTH: 8          // 主通道宽度，给基地更宽的路
};

// 地图类型
const TILE = {
    EMPTY: 0,
    WALL: 1
};

// 全局变量
let canvas, ctx;
let gameMap = [];
let gameState = {
    isRunning: false,
    isPaused: false,
    speedMultiplier: 1,  // 倍速设置
    startTime: null,     // 游戏开始时间
    pauseTime: null,     // 暂停时间
    pausedDuration: 0,   // 累计暂停时长
    survivalTime: 0,     // 存活时间
    winTime: 60000       // 胜利时间：60秒
};

// 游戏实体
let entities = {
    base: null,
    pursuers: [],
    altars: [],
    targets: []
};

// A*寻路相关
class PathNode {
    constructor(x, y, g = 0, h = 0, parent = null) {
        this.x = x;
        this.y = y;
        this.g = g; // 从起点到当前点的实际距离
        this.h = h; // 从当前点到终点的启发式距离
        this.f = g + h; // 总评估值
        this.parent = parent;
    }
}

// 初始化游戏
function initGame() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // 设置canvas尺寸
    const canvasSize = CONFIG.MAP_SIZE * CONFIG.CELL_SIZE;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    
    // 绑定控制按钮
    setupControls();
    
    // 生成初始地图
    generateNewMap();
}

// 设置控制按钮
function setupControls() {
    document.getElementById('generateBtn').onclick = generateNewMap;
    document.getElementById('startBtn').onclick = startSimulation;
    document.getElementById('pauseBtn').onclick = pauseSimulation;
    document.getElementById('resetBtn').onclick = resetSimulation;
    
    // 倍速控制
    document.getElementById('speed1x').onclick = () => setSpeed(1);
    document.getElementById('speed2x').onclick = () => setSpeed(2);
    document.getElementById('speed4x').onclick = () => setSpeed(4);
}

// 设置游戏倍速
function setSpeed(multiplier) {
    gameState.speedMultiplier = multiplier;
    
    // 更新按钮状态
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`speed${multiplier}x`).classList.add('active');
    
    // 更新显示
    document.getElementById('currentSpeed').textContent = `×${multiplier}`;
    
    console.log(`游戏倍速设置为: ×${multiplier}`);
}

// 生成新地图
function generateNewMap() {
    console.log('生成新地图...');
    
    // 重置所有数据
    resetGameData();
    
    // 生成迷宫
    generateMaze();
    
    // 放置实体
    placeEntities();
    
    // 立即绘制地图并更新UI
    setTimeout(() => {
        drawMap();
        updateUI();
        console.log('地图生成完成，所有实体已放置并显示');
    }, 100);
}

// 重置游戏数据
function resetGameData() {
    gameState.isRunning = false;
    gameState.isPaused = false;
    gameState.startTime = null;
    gameState.pauseTime = null;
    gameState.pausedDuration = 0;
    gameState.survivalTime = 0;
    
    entities.base = { 
        x: 0, y: 0, 
        width: CONFIG.BASE_SIZE, 
        height: CONFIG.BASE_SIZE, 
        hp: CONFIG.BASE_HP, 
        targetIndex: 0, 
        path: [], 
        moving: false,
        emergencyMode: false,
        emergencyStartTime: null,
        lastTargetChangeTime: null,
        crushTargets: new Map(), // 记录正在碾压的追兵和开始时间
        lastShockwaveTime: 0,    // 上次释放冲击波的时间
        shockwaveActive: false,  // 冲击波是否正在播放动画
        shockwaveStartTime: 0,   // 冲击波动画开始时间
        pathfindingFailures: 0,  // 寻路失败次数
        temporaryTarget: null,   // 临时目标索引
        emergencyPathMode: false // 应急寻路模式
    };
    entities.pursuers = [];
    entities.altars = [];
    entities.targets = [];
    
    // 重置地图
    gameMap = [];
    for (let y = 0; y < CONFIG.MAP_SIZE; y++) {
        gameMap[y] = new Array(CONFIG.MAP_SIZE).fill(TILE.EMPTY);
    }
}

// 改进的迷宫生成算法
function generateMaze() {
    console.log('开始生成迷宫...');
    
    // 初始化为全空地
    for (let y = 0; y < CONFIG.MAP_SIZE; y++) {
        for (let x = 0; x < CONFIG.MAP_SIZE; x++) {
            gameMap[y][x] = TILE.EMPTY;
        }
    }
    
    // 生成密集的障碍物迷宫
    generateDenseObstacles();
    
    // 确保有基本的通道网络
    createMainPaths();
    
    // 清理和连通性检查
    ensureConnectivity();
    
    console.log('迷宫生成完成');
}

// 生成密集障碍物
function generateDenseObstacles() {
    // 创建网格状的障碍物基础，但要考虑通道需求
    for (let y = 0; y < CONFIG.MAP_SIZE; y += 12) {
        for (let x = 0; x < CONFIG.MAP_SIZE; x += 12) {
            // 在每个12x12区域内创建障碍物，但保留通道
            createSmartObstacleCluster(x, y, Math.min(12, CONFIG.MAP_SIZE - x), Math.min(12, CONFIG.MAP_SIZE - y));
        }
    }
}

// 智能创建障碍物集群，确保通道畅通
function createSmartObstacleCluster(startX, startY, width, height) {
    // 在区域内创建2-3个较大的障碍物，但确保留有通道
    let obstacleCount = Math.floor(Math.random() * 2) + 2; // 每个区域2-3个障碍物
    
    for (let i = 0; i < obstacleCount; i++) {
        let size = Math.floor(Math.random() * 4) + 2; // 障碍物大小2-5
        
        // 确保障碍物不占据整个区域，留出通道空间
        let maxX = width - size - CONFIG.PURSUER_CORRIDOR_WIDTH;
        let maxY = height - size - CONFIG.PURSUER_CORRIDOR_WIDTH;
        
        if (maxX <= 0 || maxY <= 0) continue; // 区域太小，跳过
        
        let x = startX + Math.floor(Math.random() * maxX) + 2;
        let y = startY + Math.floor(Math.random() * maxY) + 2;
        
        // 创建障碍物
        for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
                if (x + dx < CONFIG.MAP_SIZE && y + dy < CONFIG.MAP_SIZE) {
                    gameMap[y + dy][x + dx] = TILE.WALL;
                }
            }
        }
    }
}

// 创建主要通道
function createMainPaths() {
    // 创建多条主通道，确保基地和追兵都能通过
    let centerX = Math.floor(CONFIG.MAP_SIZE / 2);
    let centerY = Math.floor(CONFIG.MAP_SIZE / 2);
    
    // 中央十字型主通道（给基地用）
    createWideCorridor(0, centerY, CONFIG.MAP_SIZE, centerY, CONFIG.MAIN_CORRIDOR_WIDTH); // 水平
    createWideCorridor(centerX, 0, centerX, CONFIG.MAP_SIZE, CONFIG.MAIN_CORRIDOR_WIDTH); // 垂直
    
    // 创建额外的次要通道（给追兵用）
    let quarterX = Math.floor(CONFIG.MAP_SIZE / 4);
    let threeQuarterX = Math.floor(CONFIG.MAP_SIZE * 3 / 4);
    let quarterY = Math.floor(CONFIG.MAP_SIZE / 4);
    let threeQuarterY = Math.floor(CONFIG.MAP_SIZE * 3 / 4);
    
    // 四分之一和四分之三位置的通道
    createWideCorridor(0, quarterY, CONFIG.MAP_SIZE, quarterY, CONFIG.PURSUER_CORRIDOR_WIDTH);
    createWideCorridor(0, threeQuarterY, CONFIG.MAP_SIZE, threeQuarterY, CONFIG.PURSUER_CORRIDOR_WIDTH);
    createWideCorridor(quarterX, 0, quarterX, CONFIG.MAP_SIZE, CONFIG.PURSUER_CORRIDOR_WIDTH);
    createWideCorridor(threeQuarterX, 0, threeQuarterX, CONFIG.MAP_SIZE, CONFIG.PURSUER_CORRIDOR_WIDTH);
    
    // 创建边界通道
    createBorderPaths();
    
    // 创建一些随机的连接通道
    for (let i = 0; i < 15; i++) {
        createRandomPath();
    }
}

// 创建指定宽度的通道
function createWideCorridor(x1, y1, x2, y2, width) {
    let steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    
    for (let i = 0; i <= steps; i++) {
        let x = Math.floor(x1 + (x2 - x1) * i / steps);
        let y = Math.floor(y1 + (y2 - y1) * i / steps);
        
        // 创建指定宽度的通道
        for (let dx = -Math.floor(width/2); dx <= Math.floor(width/2); dx++) {
            for (let dy = -Math.floor(width/2); dy <= Math.floor(width/2); dy++) {
                let nx = x + dx;
                let ny = y + dy;
                if (nx >= 0 && nx < CONFIG.MAP_SIZE && ny >= 0 && ny < CONFIG.MAP_SIZE) {
                    gameMap[ny][nx] = TILE.EMPTY;
                }
            }
        }
    }
}

// 创建随机通道
function createRandomPath() {
    let startX = Math.floor(Math.random() * CONFIG.MAP_SIZE);
    let startY = Math.floor(Math.random() * CONFIG.MAP_SIZE);
    let endX = Math.floor(Math.random() * CONFIG.MAP_SIZE);
    let endY = Math.floor(Math.random() * CONFIG.MAP_SIZE);
    
    // 使用L型路径而不是直线，更自然
    createPathBetween(startX, startY, endX, endY);
}

// 确保连通性
function ensureConnectivity() {
    // 简单的连通性确保：在地图四角创建通道到中心
    let corners = [
        {x: 20, y: 20},
        {x: CONFIG.MAP_SIZE - 20, y: 20},
        {x: 20, y: CONFIG.MAP_SIZE - 20},
        {x: CONFIG.MAP_SIZE - 20, y: CONFIG.MAP_SIZE - 20}
    ];
    
    let center = {x: Math.floor(CONFIG.MAP_SIZE / 2), y: Math.floor(CONFIG.MAP_SIZE / 2)};
    
    for (let corner of corners) {
        createPathBetween(corner.x, corner.y, center.x, center.y);
    }
}

// 在两点之间创建路径
function createPathBetween(x1, y1, x2, y2) {
    // L型路径，确保追兵能通过
    let corridorWidth = CONFIG.PURSUER_CORRIDOR_WIDTH;
    let halfWidth = Math.floor(corridorWidth / 2);
    
    // 先水平移动
    let minX = Math.min(x1, x2);
    let maxX = Math.max(x1, x2);
    for (let x = minX; x <= maxX; x++) {
        for (let dy = -halfWidth; dy <= halfWidth; dy++) {
            let y = y1 + dy;
            if (y >= 0 && y < CONFIG.MAP_SIZE) {
                gameMap[y][x] = TILE.EMPTY;
            }
        }
    }
    
    // 再垂直移动
    let minY = Math.min(y1, y2);
    let maxY = Math.max(y1, y2);
    for (let y = minY; y <= maxY; y++) {
        for (let dx = -halfWidth; dx <= halfWidth; dx++) {
            let x = x2 + dx;
            if (x >= 0 && x < CONFIG.MAP_SIZE) {
                gameMap[y][x] = TILE.EMPTY;
            }
        }
    }
}



// 创建边界通道
function createBorderPaths() {
    const borderWidth = CONFIG.MIN_CORRIDOR_WIDTH;
    
    // 确保四个边界有足够宽的通道
    for (let i = 0; i < CONFIG.MAP_SIZE; i++) {
        // 顶部边界通道
        for (let j = 1; j <= borderWidth; j++) {
            if (j < CONFIG.MAP_SIZE) {
                gameMap[j][i] = TILE.EMPTY;
            }
        }
        
        // 底部边界通道
        for (let j = 1; j <= borderWidth; j++) {
            if (CONFIG.MAP_SIZE - 1 - j >= 0) {
                gameMap[CONFIG.MAP_SIZE - 1 - j][i] = TILE.EMPTY;
            }
        }
        
        // 左侧边界通道
        for (let j = 1; j <= borderWidth; j++) {
            if (j < CONFIG.MAP_SIZE) {
                gameMap[i][j] = TILE.EMPTY;
            }
        }
        
        // 右侧边界通道
        for (let j = 1; j <= borderWidth; j++) {
            if (CONFIG.MAP_SIZE - 1 - j >= 0) {
                gameMap[i][CONFIG.MAP_SIZE - 1 - j] = TILE.EMPTY;
            }
        }
    }
}



// 放置实体
function placeEntities() {
    console.log('开始放置实体...');
    
    // 放置基地 (最先放置，因为其他实体需要避开它)
    let basePos = findValidPosition(CONFIG.BASE_SIZE, CONFIG.BASE_SIZE);
    if (basePos) {
        entities.base.x = basePos.x;
        entities.base.y = basePos.y;
        console.log(`基地(${CONFIG.BASE_SIZE}x${CONFIG.BASE_SIZE})放置在: (${basePos.x}, ${basePos.y})`);
    } else {
        console.error('无法放置基地！');
        return;
    }
    
    // 放置目标点 (确保与基地和之前的目标点不重叠)
    for (let i = 0; i < CONFIG.NUM_TARGETS; i++) {
        let pos = findValidPositionExcluding(CONFIG.TARGET_SIZE, CONFIG.TARGET_SIZE, getAllExistingEntities());
        if (pos) {
            entities.targets.push({
                x: pos.x, y: pos.y, width: CONFIG.TARGET_SIZE, height: CONFIG.TARGET_SIZE,
                id: `target_${i}`
            });
            console.log(`目标点${i+1}放置在: (${pos.x}, ${pos.y})`);
        } else {
            console.warn(`无法放置目标点${i+1}`);
        }
    }
    
    // 放置祭坛
    for (let i = 0; i < CONFIG.NUM_ALTARS; i++) {
        let pos = findValidPositionExcluding(CONFIG.ALTAR_SIZE, CONFIG.ALTAR_SIZE, getAllExistingEntities());
        if (pos) {
            entities.altars.push({
                x: pos.x, y: pos.y, width: CONFIG.ALTAR_SIZE, height: CONFIG.ALTAR_SIZE,
                id: `altar_${i}`, lastDamageTime: 0
            });
            console.log(`祭坛${i+1}放置在: (${pos.x}, ${pos.y})`);
        } else {
            console.warn(`无法放置祭坛${i+1}`);
        }
    }
    
    // 放置追兵
    for (let i = 0; i < CONFIG.NUM_PURSUERS; i++) {
        let pos = findValidPositionExcluding(CONFIG.PURSUER_SIZE, CONFIG.PURSUER_SIZE, getAllExistingEntities());
        if (pos) {
            entities.pursuers.push({
                x: pos.x, y: pos.y, width: CONFIG.PURSUER_SIZE, height: CONFIG.PURSUER_SIZE,
                id: `pursuer_${i}`, lastAttackTime: 0,
                path: [], strategy: null, lastTarget: null
            });
        } else {
            console.warn(`无法放置追兵${i+1}`);
        }
    }
    
    console.log(`实体放置完成: 基地1个, 目标${entities.targets.length}个, 祭坛${entities.altars.length}个, 追兵${entities.pursuers.length}个`);
}

// 获取所有已存在的实体
function getAllExistingEntities() {
    let allEntities = [];
    if (entities.base) allEntities.push(entities.base);
    allEntities.push(...entities.targets);
    allEntities.push(...entities.altars);
    allEntities.push(...entities.pursuers);
    return allEntities;
}

// 查找有效位置，排除指定实体
function findValidPositionExcluding(width, height, excludeEntities = [], maxAttempts = 2000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let x = Math.floor(Math.random() * (CONFIG.MAP_SIZE - width));
        let y = Math.floor(Math.random() * (CONFIG.MAP_SIZE - height));
        
        if (isPositionValidExcluding(x, y, width, height, excludeEntities)) {
            return { x, y };
        }
    }
    console.warn(`无法找到大小为${width}x${height}的有效位置`);
    return null;
}

// 检查位置是否有效，排除指定实体
function isPositionValidExcluding(x, y, width, height, excludeEntities = []) {
    // 检查地图边界
    if (x < 0 || y < 0 || x + width > CONFIG.MAP_SIZE || y + height > CONFIG.MAP_SIZE) {
        return false;
    }
    
    // 检查是否与墙碰撞
    for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
            if (gameMap[y + dy][x + dx] === TILE.WALL) {
                return false;
            }
        }
    }
    
    // 检查是否与现有实体重叠
    for (let entity of excludeEntities) {
        if (!(x + width <= entity.x || x >= entity.x + entity.width ||
              y + height <= entity.y || y >= entity.y + entity.height)) {
            return false; // 重叠
        }
    }
    
    return true;
}

// 查找有效位置
function findValidPosition(width, height, maxAttempts = 1000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let x = Math.floor(Math.random() * (CONFIG.MAP_SIZE - width));
        let y = Math.floor(Math.random() * (CONFIG.MAP_SIZE - height));
        
        if (isPositionValid(x, y, width, height)) {
            return { x, y };
        }
    }
    console.warn(`无法找到大小为${width}x${height}的有效位置`);
    return null;
}

// 检查位置是否有效（通用版本，用于寻路）
function isPositionValid(x, y, width, height) {
    // 检查地图边界
    if (x < 0 || y < 0 || x + width > CONFIG.MAP_SIZE || y + height > CONFIG.MAP_SIZE) {
        return false;
    }
    
    // 检查是否与墙碰撞
    for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
            if (gameMap[y + dy][x + dx] === TILE.WALL) {
                return false;
            }
        }
    }
    
    return true;
}

// 检查基地移动位置是否有效
function isPositionValidForBase(x, y) {
    // 检查地图边界
    if (x < 0 || y < 0 || x + CONFIG.BASE_SIZE > CONFIG.MAP_SIZE || y + CONFIG.BASE_SIZE > CONFIG.MAP_SIZE) {
        return false;
    }
    
    // 检查是否与墙碰撞
    for (let dy = 0; dy < CONFIG.BASE_SIZE; dy++) {
        for (let dx = 0; dx < CONFIG.BASE_SIZE; dx++) {
            if (gameMap[y + dy][x + dx] === TILE.WALL) {
                return false;
            }
        }
    }
    
    // 基地不检查追兵碰撞，因为基地可以碾压追兵
    // 碾压逻辑在实际移动时处理
    
    return true;
}

// A*寻路算法
function findPath(startX, startY, endX, endY, entityWidth = 1, entityHeight = 1) {
    if (!isPositionValid(endX, endY, entityWidth, entityHeight)) {
        return null; // 目标位置无效
    }
    
    let openList = [new PathNode(startX, startY, 0, heuristic(startX, startY, endX, endY))];
    let closedList = new Set();
    let openMap = new Map();
    openMap.set(`${startX},${startY}`, openList[0]);
    
    const directions = [
        {dx: 0, dy: -1}, {dx: 1, dy: 0}, {dx: 0, dy: 1}, {dx: -1, dy: 0}
    ];
    
    while (openList.length > 0) {
        // 选择f值最小的节点
        openList.sort((a, b) => a.f - b.f);
        let current = openList.shift();
        openMap.delete(`${current.x},${current.y}`);
        
        let currentKey = `${current.x},${current.y}`;
        closedList.add(currentKey);
        
        // 到达目标
        if (Math.abs(current.x - endX) < entityWidth && Math.abs(current.y - endY) < entityHeight) {
            let path = [];
            let node = current;
            while (node) {
                path.unshift({x: node.x, y: node.y});
                node = node.parent;
            }
            return path;
        }
        
        // 探索邻居
        for (let dir of directions) {
            let nx = current.x + dir.dx;
            let ny = current.y + dir.dy;
            let neighborKey = `${nx},${ny}`;
            
            if (closedList.has(neighborKey)) continue;
            
            if (!isPositionValid(nx, ny, entityWidth, entityHeight)) continue;
            
            let g = current.g + 1;
            let h = heuristic(nx, ny, endX, endY);
            let f = g + h;
            
            let existingNode = openMap.get(neighborKey);
            if (!existingNode || g < existingNode.g) {
                let newNode = new PathNode(nx, ny, g, h, current);
                if (existingNode) {
                    // 更新现有节点
                    existingNode.g = g;
                    existingNode.h = h;
                    existingNode.f = f;
                    existingNode.parent = current;
                } else {
                    // 添加新节点
                    openList.push(newNode);
                    openMap.set(neighborKey, newNode);
                }
            }
        }
    }
    
    return null; // 没有找到路径
}

// 启发式函数（曼哈顿距离）
function heuristic(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

// 绘制地图
function drawMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制地图瓦片
    for (let y = 0; y < CONFIG.MAP_SIZE; y++) {
        for (let x = 0; x < CONFIG.MAP_SIZE; x++) {
            ctx.fillStyle = gameMap[y][x] === TILE.WALL ? '#333333' : '#ffffff';
            ctx.fillRect(x * CONFIG.CELL_SIZE, y * CONFIG.CELL_SIZE, CONFIG.CELL_SIZE, CONFIG.CELL_SIZE);
        }
    }
    
    // 绘制目标点（绿色）
    ctx.fillStyle = '#00ff00';
    for (let target of entities.targets) {
        ctx.fillRect(target.x * CONFIG.CELL_SIZE, target.y * CONFIG.CELL_SIZE, 
                    target.width * CONFIG.CELL_SIZE, target.height * CONFIG.CELL_SIZE);
    }
    
    // 绘制祭坛（红色）
    ctx.fillStyle = '#ff0000';
    for (let altar of entities.altars) {
        ctx.fillRect(altar.x * CONFIG.CELL_SIZE, altar.y * CONFIG.CELL_SIZE, 
                    altar.width * CONFIG.CELL_SIZE, altar.height * CONFIG.CELL_SIZE);
    }
    
    // 绘制追兵（黄色填充，黑色边框）
    for (let pursuer of entities.pursuers) {
        // 填充黄色
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(pursuer.x * CONFIG.CELL_SIZE, pursuer.y * CONFIG.CELL_SIZE, 
                    pursuer.width * CONFIG.CELL_SIZE, pursuer.height * CONFIG.CELL_SIZE);
        
        // 黑色边框
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(pursuer.x * CONFIG.CELL_SIZE, pursuer.y * CONFIG.CELL_SIZE, 
                      pursuer.width * CONFIG.CELL_SIZE, pursuer.height * CONFIG.CELL_SIZE);
    }
    
    // 绘制基地（蓝色，碾压时闪烁红色）
    if (entities.base) {
        let isCanCrushing = entities.base.crushTargets.size > 0;
        ctx.fillStyle = isCanCrushing ? '#ff4444' : '#0000ff'; // 碾压时显示红色
        ctx.fillRect(entities.base.x * CONFIG.CELL_SIZE, entities.base.y * CONFIG.CELL_SIZE, 
                    entities.base.width * CONFIG.CELL_SIZE, entities.base.height * CONFIG.CELL_SIZE);
        
        // 如果正在碾压，显示警告效果
        if (isCanCrushing) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(entities.base.x * CONFIG.CELL_SIZE, entities.base.y * CONFIG.CELL_SIZE, 
                          entities.base.width * CONFIG.CELL_SIZE, entities.base.height * CONFIG.CELL_SIZE);
        }
    }
    
    // 绘制冲击波动画
    if (entities.base && entities.base.shockwaveActive) {
        drawShockwaveAnimation();
    }
    
    // 绘制基地的路径（如果存在）
    if (entities.base && entities.base.path && entities.base.path.length > 1) {
        ctx.strokeStyle = '#0088ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < entities.base.path.length; i++) {
            let point = entities.base.path[i];
            let pixelX = (point.x + 1) * CONFIG.CELL_SIZE;
            let pixelY = (point.y + 1) * CONFIG.CELL_SIZE;
            if (i === 0) {
                ctx.moveTo(pixelX, pixelY);
            } else {
                ctx.lineTo(pixelX, pixelY);
            }
        }
        ctx.stroke();
    }
    
    // 绘制追兵的路径（仅显示前几个追兵的路径以避免过于杂乱）
    for (let i = 0; i < Math.min(3, entities.pursuers.length); i++) {
        let pursuer = entities.pursuers[i];
        if (pursuer.path && pursuer.path.length > 1) {
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let j = 0; j < pursuer.path.length; j++) {
                let point = pursuer.path[j];
                let pixelX = (point.x + 1.5) * CONFIG.CELL_SIZE;
                let pixelY = (point.y + 1.5) * CONFIG.CELL_SIZE;
                if (j === 0) {
                    ctx.moveTo(pixelX, pixelY);
                } else {
                    ctx.lineTo(pixelX, pixelY);
                }
            }
            ctx.stroke();
        }
    }
}

// 绘制冲击波动画
function drawShockwaveAnimation() {
    let currentTime = Date.now();
    let elapsedTime = currentTime - entities.base.shockwaveStartTime;
    let progress = Math.min(1, elapsedTime / (CONFIG.SHOCKWAVE_ANIMATION_TIME / gameState.speedMultiplier));
    
    // 计算基地中心
    let baseCenterX = (entities.base.x + CONFIG.BASE_SIZE / 2) * CONFIG.CELL_SIZE;
    let baseCenterY = (entities.base.y + CONFIG.BASE_SIZE / 2) * CONFIG.CELL_SIZE;
    
    // 冲击波最大半径
    let maxRadius = CONFIG.SHOCKWAVE_RANGE * CONFIG.CELL_SIZE;
    
    // 绘制从中心向外扩散的冲击波
    for (let i = 0; i < 3; i++) { // 绘制3层波纹
        let waveProgress = Math.max(0, progress - i * 0.1); // 每层延迟0.1
        if (waveProgress > 0) {
            let radius = maxRadius * waveProgress;
            let alpha = (1 - waveProgress) * 0.8; // 透明度随时间减少
            
            // 绘制红色冲击波圆圈
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3 - i; // 外层波纹更细
            ctx.beginPath();
            ctx.arc(baseCenterX, baseCenterY, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
    
    // 绘制中心红色区域
    if (progress < 0.3) { // 前30%时间显示中心红色区域
        let centerAlpha = (0.3 - progress) / 0.3 * 0.5;
        ctx.save();
        ctx.globalAlpha = centerAlpha;
        ctx.fillStyle = '#ff0000';
        
        // 绘制5x5的红色区域
        let startX = (entities.base.x + CONFIG.BASE_SIZE / 2 - CONFIG.SHOCKWAVE_RANGE / 2) * CONFIG.CELL_SIZE;
        let startY = (entities.base.y + CONFIG.BASE_SIZE / 2 - CONFIG.SHOCKWAVE_RANGE / 2) * CONFIG.CELL_SIZE;
        let size = CONFIG.SHOCKWAVE_RANGE * CONFIG.CELL_SIZE;
        
        ctx.fillRect(startX, startY, size, size);
        ctx.restore();
    }
}

// 更新UI
function updateUI() {
    document.getElementById('baseHP').textContent = entities.base ? entities.base.hp : 0;
    
    // 更新存活时间显示
    let minutes = Math.floor(gameState.survivalTime / 60000);
    let seconds = Math.floor((gameState.survivalTime % 60000) / 1000);
    document.getElementById('survivalTime').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // 更新冲击波倒计时
    if (entities.base) {
        let currentTime = Date.now();
        
        if (entities.base.shockwaveActive) {
            // 正在释放冲击波
            document.getElementById('shockwaveCountdown').textContent = '🌊 释放中';
        } else {
            // 正常倒计时
            let timeSinceLastShockwave = currentTime - entities.base.lastShockwaveTime;
            let shockwaveInterval = CONFIG.SHOCKWAVE_INTERVAL / gameState.speedMultiplier;
            let timeUntilNext = Math.max(0, shockwaveInterval - timeSinceLastShockwave);
            let countdown = (timeUntilNext / 1000).toFixed(1);
            document.getElementById('shockwaveCountdown').textContent = `${countdown}s (最多${CONFIG.SHOCKWAVE_MAX_KILLS}杀)`;
        }
    }
    
    document.getElementById('currentTarget').textContent = 
        entities.base && entities.targets.length > 0 ? 
        `目标${entities.base.targetIndex + 1}` : '-';
    document.getElementById('pursuerCount').textContent = entities.pursuers.length;
    document.getElementById('altarCount').textContent = entities.altars.length;
}

// 开始模拟
function startSimulation() {
    if (!gameState.isRunning) {
        gameState.isRunning = true;
        gameState.isPaused = false;
        gameState.startTime = Date.now();
        gameState.pauseTime = null;
        gameState.pausedDuration = 0;
        gameState.survivalTime = 0;
        
        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        
        console.log('开始模拟...');
        gameLoop();
    }
}

// 暂停模拟
function pauseSimulation() {
    if (gameState.isPaused) {
        // 继续游戏
        if (gameState.pauseTime) {
            // 累计暂停时长
            gameState.pausedDuration += Date.now() - gameState.pauseTime;
            gameState.pauseTime = null;
        }
        gameState.isPaused = false;
        document.getElementById('pauseBtn').textContent = '暂停';
        console.log('模拟已继续');
    } else {
        // 暂停游戏
        gameState.isPaused = true;
        gameState.pauseTime = Date.now();
        document.getElementById('pauseBtn').textContent = '继续';
        console.log('模拟已暂停');
    }
}

// 重置模拟
function resetSimulation() {
    gameState.isRunning = false;
    gameState.isPaused = false;
    
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('pauseBtn').textContent = '暂停';
    
    // 重置实体状态
    if (entities.base) {
        entities.base.hp = CONFIG.BASE_HP;
        entities.base.path = [];
        entities.base.moving = false;
    }
    
    updateUI();
    drawMap();
    
    console.log('模拟已重置');
}

// 游戏主循环
function gameLoop() {
    if (!gameState.isRunning || gameState.isPaused) {
        if (gameState.isRunning) {
            setTimeout(gameLoop, 100);
        }
        return;
    }
    
    let currentTime = Date.now();
    
    // 更新存活时间（排除暂停时间）
    if (gameState.startTime) {
        gameState.survivalTime = currentTime - gameState.startTime - gameState.pausedDuration;
    }
    
    // 检查胜利条件
    if (gameState.survivalTime >= gameState.winTime) {
        console.log('游戏胜利：基地存活60秒！');
        alert('🎉 恭喜！基地成功存活60秒，游戏胜利！');
        resetSimulation();
        return;
    }
    
    // 更新基地
    updateBase(currentTime);
    
    // 更新追兵
    updatePursuers(currentTime);
    
    // 处理祭坛伤害
    updateAltars(currentTime);
    
    // 冲击波处理 - 独立于基地状态，确保每5秒必定释放
    if (entities.base) {
        processShockwave(currentTime);
    }
    
    // 强制重绘地图（确保看到移动）
    drawMap();
    updateUI();
    
    // 检查失败条件
    if (entities.base && entities.base.hp <= 0) {
        console.log('游戏结束：基地被摧毁');
        alert('💀 游戏失败：基地被摧毁！');
        resetSimulation();
        return;
    }
    
    // 继续游戏循环 (根据倍速调整)
    let baseInterval = 100; // 基础间隔100ms
    let actualInterval = Math.max(16, baseInterval / gameState.speedMultiplier); // 最小16ms (60 FPS)
    setTimeout(gameLoop, actualInterval);
}

// 更新基地
function updateBase(currentTime) {
    if (!entities.base || entities.targets.length === 0) {
        return;
    }
    
    // 检测紧急威胁
    let emergencyThreat = detectEmergencyThreat();
    
    // 如果有紧急威胁，进入逃脱模式
    if (emergencyThreat.isEmergency) {
        handleEmergencyEscape(emergencyThreat, currentTime);
        // 紧急逃脱时也要处理碾压（冲击波在主循环中处理）
        processCrushTargets(currentTime);
        return;
    }
    
    // 正常目标导航模式
    if (!entities.base.path || entities.base.path.length <= 1) {
        // 始终尝试到达当前目标，使用智能路径规划
        let target = entities.targets[entities.base.targetIndex];
        if (target) {
            let path = findOptimalPath(entities.base.x, entities.base.y, target.x, target.y);
            if (path && path.length > 1) {
                entities.base.path = path;
                entities.base.lastMoveTime = currentTime;
                console.log(`基地找到到目标${entities.base.targetIndex + 1}的路径，长度: ${path.length}`);
            } else {
                // 如果完全无法到达当前目标，尝试应急移动
                console.log(`基地无法到达目标${entities.base.targetIndex + 1}，尝试应急移动`);
                tryEmergencyMovementToTarget(currentTime);
            }
        }
    }
    
    // 移动基地
    if (entities.base.path && entities.base.path.length > 1) {
        if (!entities.base.lastMoveTime) {
            entities.base.lastMoveTime = currentTime;
        }
        
        if (currentTime - entities.base.lastMoveTime >= CONFIG.BASE_SPEED / gameState.speedMultiplier) {
            entities.base.path.shift(); // 移除第一个点（当前位置）
            if (entities.base.path.length > 0) {
                let nextPos = entities.base.path[0];
                
                // 检查是否有追兵阻挡，并处理碾压逻辑
                let blockingPursuer = getBlockingPursuer(nextPos.x, nextPos.y);
                if (blockingPursuer) {
                    handleBaseCrush(blockingPursuer, currentTime);
                    // 碾压时不移动基地，但继续处理其他逻辑
                } else {
                    // 检查下一个位置是否仍然有效（不考虑追兵，因为碾压逻辑已处理）
                    if (isPositionValidForBaseMovement(nextPos.x, nextPos.y)) {
                        entities.base.x = nextPos.x;
                        entities.base.y = nextPos.y;
                        entities.base.lastMoveTime = currentTime;
                        
                        // 重置路径失败计数
                        entities.base.pathfindingFailures = 0;
                        
                        // 检查是否到达目标
                        let target = entities.targets[entities.base.targetIndex];
                        if (target && Math.abs(entities.base.x - target.x) <= 1 && 
                            Math.abs(entities.base.y - target.y) <= 1) {
                            let oldTargetIndex = entities.base.targetIndex;
                            entities.base.targetIndex = (entities.base.targetIndex + 1) % entities.targets.length;
                            entities.base.path = [];
                            entities.base.lastTargetChangeTime = currentTime; // 重要：更新换目标时间
                            console.log(`基地到达目标点${oldTargetIndex + 1}，切换到目标${entities.base.targetIndex + 1}`);
                        }
                    } else {
                        // 路径被阻塞，记录失败并重新计算路径
                        console.log('基地路径被阻塞，重新计算路径');
                        entities.base.path = [];
                        
                        // 记录寻路失败次数
                        if (!entities.base.pathfindingFailures) {
                            entities.base.pathfindingFailures = 0;
                        }
                        entities.base.pathfindingFailures++;
                        
                        // 如果连续失败多次，尝试更激进的策略
                        if (entities.base.pathfindingFailures >= 3) {
                            console.log(`⚠️ 基地连续寻路失败${entities.base.pathfindingFailures}次，尝试应急寻路策略`);
                            tryEmergencyPathfinding(currentTime);
                        }
                    }
                }
            }
        }
    }
    
    // 处理正在进行的碾压
    processCrushTargets(currentTime);
    
    // 注意：冲击波处理已移到游戏主循环中
}

// 更新追兵（智能AI：拦截和围堵策略）
function updatePursuers(currentTime) {
    if (!entities.base) return;
    
    for (let pursuer of entities.pursuers) {
        // 移动追兵
        if (!pursuer.lastMoveTime) {
            pursuer.lastMoveTime = currentTime;
        }
        
        if (currentTime - pursuer.lastMoveTime >= CONFIG.PURSUER_SPEED / gameState.speedMultiplier) {
            // 使用智能策略移动追兵
            movePursuerWithStrategy(pursuer, currentTime);
        }
        
        // 攻击基地
        if (!pursuer.lastAttackTime) {
            pursuer.lastAttackTime = currentTime;
        }
        
        // 检查周围是否有其他追兵，动态调整攻击间隔
        let nearbyPursuers = countNearbyPursuers(pursuer);
        let attackInterval = nearbyPursuers > 0 ? CONFIG.PURSUER_ATTACK_INTERVAL_FAST : CONFIG.PURSUER_ATTACK_INTERVAL;
        let actualAttackInterval = attackInterval / gameState.speedMultiplier;
        
        if (currentTime - pursuer.lastAttackTime >= actualAttackInterval) {
            let distance = Math.max(Math.abs(pursuer.x - entities.base.x), 
                                  Math.abs(pursuer.y - entities.base.y));
            if (distance <= CONFIG.PURSUER_ATTACK_RANGE) {
                entities.base.hp -= CONFIG.PURSUER_DAMAGE;
                let intervalText = nearbyPursuers > 0 ? '快速攻击' : '普通攻击';
                console.log(`追兵${pursuer.id}${intervalText}基地，基地血量: ${entities.base.hp}，周围追兵数: ${nearbyPursuers}`);
                pursuer.lastAttackTime = currentTime;
            }
        }
    }
}

// 检查追兵移动位置是否有效
function isPositionValidForPursuer(x, y, pursuerId) {
    // 检查地图边界
    if (x < 0 || y < 0 || x + CONFIG.PURSUER_SIZE > CONFIG.MAP_SIZE || y + CONFIG.PURSUER_SIZE > CONFIG.MAP_SIZE) {
        return false;
    }
    
    // 检查是否与墙碰撞
    for (let dy = 0; dy < CONFIG.PURSUER_SIZE; dy++) {
        for (let dx = 0; dx < CONFIG.PURSUER_SIZE; dx++) {
            if (gameMap[y + dy][x + dx] === TILE.WALL) {
                return false;
            }
        }
    }
    
    // 检查是否与基地重叠
    if (entities.base && 
        !(x + CONFIG.PURSUER_SIZE <= entities.base.x || 
          x >= entities.base.x + entities.base.width ||
          y + CONFIG.PURSUER_SIZE <= entities.base.y || 
          y >= entities.base.y + entities.base.height)) {
        return false;
    }
    
    // 检查是否与其他追兵重叠
    for (let otherPursuer of entities.pursuers) {
        if (otherPursuer.id !== pursuerId && 
            !(x + CONFIG.PURSUER_SIZE <= otherPursuer.x || 
              x >= otherPursuer.x + otherPursuer.width ||
              y + CONFIG.PURSUER_SIZE <= otherPursuer.y || 
              y >= otherPursuer.y + otherPursuer.height)) {
            return false;
        }
    }
    
    return true;
}

// 计算追兵周围其他追兵的数量
function countNearbyPursuers(targetPursuer) {
    let count = 0;
    for (let otherPursuer of entities.pursuers) {
        if (otherPursuer.id !== targetPursuer.id) {
            let distance = Math.max(
                Math.abs(targetPursuer.x - otherPursuer.x),
                Math.abs(targetPursuer.y - otherPursuer.y)
            );
            if (distance <= CONFIG.PURSUER_DETECTION_RANGE) {
                count++;
            }
        }
    }
    return count;
}

// 智能追兵移动策略
function movePursuerWithStrategy(pursuer, currentTime) {
    // 为每个追兵分配策略
    if (!pursuer.strategy) {
        pursuer.strategy = assignPursuerStrategy(pursuer);
    }
    
    let targetPos = null;
    
    // 检查冲击波威胁
    let shockwaveThreat = evaluateShockwaveThreat(pursuer, currentTime);
    
    switch (pursuer.strategy) {
        case 'predictive_intercept':
            targetPos = shockwaveThreat.shouldEvade ? 
                calculateEvadePosition(pursuer, shockwaveThreat) : 
                calculatePredictiveInterceptPosition(pursuer);
            break;
        case 'intercept':
            targetPos = shockwaveThreat.shouldEvade ? 
                calculateEvadePosition(pursuer, shockwaveThreat) : 
                calculateInterceptPosition(pursuer);
            break;
        case 'surround':
            targetPos = shockwaveThreat.shouldEvade ? 
                calculateEvadePosition(pursuer, shockwaveThreat) : 
                calculateSurroundPosition(pursuer);
            break;
        case 'harass':
            targetPos = calculateHarassPosition(pursuer, shockwaveThreat);
            break;
        case 'direct':
        default:
            targetPos = shockwaveThreat.shouldEvade ? 
                calculateEvadePosition(pursuer, shockwaveThreat) : 
                {x: entities.base.x, y: entities.base.y};
            break;
    }
    
    // 计算路径并移动
    if (targetPos) {
        movePursuerToPosition(pursuer, targetPos, currentTime);
    }
}

// 分配追兵策略 - 优化预判拦截
function assignPursuerStrategy(pursuer) {
    let pursuerIndex = entities.pursuers.indexOf(pursuer);
    let totalPursuers = entities.pursuers.length;
    
    // 40%的追兵负责智能预判拦截（最重要的策略）
    if (pursuerIndex < totalPursuers * 0.4) {
        return 'predictive_intercept';
    }
    // 25%的追兵负责围堵包围
    else if (pursuerIndex < totalPursuers * 0.65) {
        return 'surround';
    }
    // 15%的追兵保持安全距离进行骚扰
    else if (pursuerIndex < totalPursuers * 0.8) {
        return 'harass';
    }
    // 其余的直接追击
    else {
        return 'direct';
    }
}

// 预判拦截位置计算（最高级策略）
function calculatePredictiveInterceptPosition(pursuer) {
    console.log(`🎯 追兵${pursuer.id}开始预判拦截分析`);
    
    // 优先级1: 基于基地实际路径的精确预判
    if (entities.base.path && entities.base.path.length > 3) {
        let interceptPoint = calculateAdvancedPathIntercept(pursuer, entities.base.path);
        if (interceptPoint) {
            console.log(`🎯 追兵${pursuer.id}选择高级路径拦截点: (${interceptPoint.x}, ${interceptPoint.y})`);
            return interceptPoint;
        }
    }
    
    // 优先级2: 基于基地目标的路径预测
    let currentTarget = entities.targets[entities.base.targetIndex];
    if (currentTarget) {
        let interceptPoint = calculateTargetPathPrediction(pursuer, currentTarget);
        if (interceptPoint) {
            console.log(`🎯 追兵${pursuer.id}选择目标路径预测点: (${interceptPoint.x}, ${interceptPoint.y})`);
            return interceptPoint;
        }
    }
    
    // 优先级3: 基于地形分析的拦截
    let terrainIntercept = calculateTerrainBasedIntercept(pursuer);
    console.log(`🎯 追兵${pursuer.id}选择地形拦截点: (${terrainIntercept.x}, ${terrainIntercept.y})`);
    return terrainIntercept;
}

// 智能拦截位置计算（普通策略）
function calculateInterceptPosition(pursuer) {
    // 策略1: 基于基地路径的预判拦截
    if (entities.base.path && entities.base.path.length > 2) {
        let interceptPoint = calculatePathInterceptPoint(pursuer, entities.base.path);
        if (interceptPoint) {
            console.log(`追兵${pursuer.id}计算路径拦截点: (${interceptPoint.x}, ${interceptPoint.y})`);
            return interceptPoint;
        }
    }
    
    // 策略2: 基于基地目标的拦截
    let currentTarget = entities.targets[entities.base.targetIndex];
    if (currentTarget) {
        let interceptPoint = calculateTargetInterceptPoint(pursuer, currentTarget);
        console.log(`追兵${pursuer.id}计算目标拦截点: (${interceptPoint.x}, ${interceptPoint.y})`);
        return interceptPoint;
    }
    
    // 策略3: 基于基地移动趋势的拦截
    return calculateMovementTrendIntercept(pursuer);
}

// 计算路径拦截点
function calculatePathInterceptPoint(pursuer, basePath) {
    // 分析基地路径，找到最佳拦截点
    let bestInterceptPoint = null;
    let bestScore = -1;
    
    // 检查路径上的多个点作为潜在拦截位置
    for (let i = 2; i < Math.min(basePath.length, 10); i++) {
        let pathPoint = basePath[i];
        
        // 计算追兵到达这个点需要的时间
        let pursuerDistance = Math.abs(pursuer.x - pathPoint.x) + Math.abs(pursuer.y - pathPoint.y);
        let pursuerTime = pursuerDistance * (CONFIG.PURSUER_SPEED / gameState.speedMultiplier);
        
        // 计算基地到达这个点需要的时间
        let baseTime = i * (CONFIG.BASE_SPEED / gameState.speedMultiplier);
        
        // 拦截成功的评分：追兵能提前或同时到达
        let timeDifference = baseTime - pursuerTime;
        let score = timeDifference; // 正数表示追兵能提前到达
        
        // 考虑战略位置加分
        if (isStrategicPosition(pathPoint.x, pathPoint.y)) {
            score += 50; // 战略位置加分
        }
        
        // 考虑瓶颈位置加分
        if (isBottleneckPosition(pathPoint.x, pathPoint.y)) {
            score += 100; // 瓶颈位置大加分
        }
        
        if (score > bestScore) {
            bestScore = score;
            bestInterceptPoint = {
                x: pathPoint.x,
                y: pathPoint.y,
                expectedArrivalTime: baseTime,
                pursuerTime: pursuerTime
            };
        }
    }
    
    return bestInterceptPoint;
}

// 计算基于目标的拦截点
function calculateTargetInterceptPoint(pursuer, target) {
    // 在基地到目标的路径上选择最佳拦截点
    let baseToTargetDx = target.x - entities.base.x;
    let baseToTargetDy = target.y - entities.base.y;
    
    // 尝试多个拦截比例
    let interceptRatios = [0.3, 0.5, 0.7]; // 30%, 50%, 70%的路径位置
    let bestIntercept = null;
    let bestScore = -1;
    
    for (let ratio of interceptRatios) {
        let interceptX = Math.floor(entities.base.x + baseToTargetDx * ratio);
        let interceptY = Math.floor(entities.base.y + baseToTargetDy * ratio);
        
        // 确保在地图范围内
        interceptX = Math.max(0, Math.min(CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE, interceptX));
        interceptY = Math.max(0, Math.min(CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE, interceptY));
        
        // 检查位置是否可达
        if (!isPositionValidForPursuer(interceptX, interceptY, pursuer.id)) {
            continue;
        }
        
        // 计算评分
        let pursuerDistance = Math.abs(pursuer.x - interceptX) + Math.abs(pursuer.y - interceptY);
        let baseDistance = Math.abs(entities.base.x - interceptX) + Math.abs(entities.base.y - interceptY);
        
        // 追兵距离越近，基地距离越远，评分越高
        let score = baseDistance - pursuerDistance;
        
        if (score > bestScore) {
            bestScore = score;
            bestIntercept = {x: interceptX, y: interceptY};
        }
    }
    
    return bestIntercept || {x: target.x, y: target.y};
}

// 高级路径拦截分析
function calculateAdvancedPathIntercept(pursuer, basePath) {
    let bestInterceptPoint = null;
    let bestScore = -Infinity;
    
    // 分析基地路径上的每个关键点
    for (let i = 3; i < Math.min(basePath.length, 15); i++) {
        let pathPoint = basePath[i];
        
        // 计算时间因子
        let pursuerDistance = Math.abs(pursuer.x - pathPoint.x) + Math.abs(pursuer.y - pathPoint.y);
        let baseDistance = i; // 基地需要i步到达
        
        // 时间优势评分（正数表示追兵能提前到达）
        let timeAdvantage = (baseDistance * CONFIG.BASE_SPEED) - (pursuerDistance * CONFIG.PURSUER_SPEED);
        
        // 地形评分
        let terrainScore = 0;
        if (isBottleneckPosition(pathPoint.x, pathPoint.y)) {
            terrainScore += 200; // 瓶颈位置极高优先级
        }
        if (isStrategicPosition(pathPoint.x, pathPoint.y)) {
            terrainScore += 100; // 战略位置高优先级
        }
        
        // 邻近追兵协调评分
        let coordinationScore = calculateCoordinationScore(pursuer, pathPoint);
        
        // 综合评分
        let totalScore = timeAdvantage + terrainScore + coordinationScore;
        
        if (totalScore > bestScore && timeAdvantage > 0) { // 只选择能提前到达的点
            bestScore = totalScore;
            bestInterceptPoint = {
                x: pathPoint.x,
                y: pathPoint.y,
                timeAdvantage: timeAdvantage,
                terrainScore: terrainScore,
                coordinationScore: coordinationScore
            };
        }
    }
    
    return bestInterceptPoint;
}

// 目标路径预测
function calculateTargetPathPrediction(pursuer, target) {
    // 预测基地到目标的最可能路径
    let predictedPath = findPathForBase(entities.base.x, entities.base.y, target.x, target.y);
    if (!predictedPath || predictedPath.length < 3) {
        return null;
    }
    
    // 在预测路径上找最佳拦截点
    return calculateAdvancedPathIntercept(pursuer, predictedPath);
}

// 基于地形的拦截分析
function calculateTerrainBasedIntercept(pursuer) {
    let target = entities.targets[entities.base.targetIndex];
    if (!target) return {x: entities.base.x, y: entities.base.y};
    
    // 分析基地到目标路径上的所有瓶颈点
    let bottlenecks = findBottlenecksBetween(entities.base.x, entities.base.y, target.x, target.y);
    
    if (bottlenecks.length > 0) {
        // 选择距离追兵最近的瓶颈点
        let nearestBottleneck = bottlenecks.reduce((closest, bottleneck) => {
            let distToPursuer = Math.abs(pursuer.x - bottleneck.x) + Math.abs(pursuer.y - bottleneck.y);
            let closestDist = Math.abs(pursuer.x - closest.x) + Math.abs(pursuer.y - closest.y);
            return distToPursuer < closestDist ? bottleneck : closest;
        }, bottlenecks[0]);
        
        return nearestBottleneck;
    }
    
    // 如果没有瓶颈，选择中间位置
    let midX = Math.floor((entities.base.x + target.x) / 2);
    let midY = Math.floor((entities.base.y + target.y) / 2);
    
    return {x: midX, y: midY};
}

// 计算协调评分（避免追兵聚集在同一点）
function calculateCoordinationScore(currentPursuer, targetPoint) {
    let score = 0;
    let nearbyPursuers = 0;
    
    for (let pursuer of entities.pursuers) {
        if (pursuer.id === currentPursuer.id) continue;
        
        // 检查其他追兵是否也在朝这个区域移动
        if (pursuer.lastTarget) {
            let distance = Math.abs(pursuer.lastTarget.x - targetPoint.x) + 
                          Math.abs(pursuer.lastTarget.y - targetPoint.y);
            if (distance < 5) {
                nearbyPursuers++;
            }
        }
    }
    
    // 如果太多追兵聚集，降低评分
    score -= nearbyPursuers * 30;
    
    return score;
}

// 找出两点之间的瓶颈位置
function findBottlenecksBetween(x1, y1, x2, y2) {
    let bottlenecks = [];
    let steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    
    for (let i = 1; i < steps; i++) {
        let x = Math.floor(x1 + (x2 - x1) * i / steps);
        let y = Math.floor(y1 + (y2 - y1) * i / steps);
        
        if (isBottleneckPosition(x, y)) {
            bottlenecks.push({x: x, y: y});
        }
    }
    
    return bottlenecks;
}

// 基于移动趋势的拦截
function calculateMovementTrendIntercept(pursuer) {
    // 如果没有路径信息，预测基地的移动方向
    let target = entities.targets[entities.base.targetIndex];
    if (!target) return {x: entities.base.x, y: entities.base.y};
    
    // 计算基地的移动方向
    let dx = target.x - entities.base.x;
    let dy = target.y - entities.base.y;
    
    // 预测基地未来几步的位置
    let steps = 8; // 预测8步
    let futureX = entities.base.x + Math.sign(dx) * Math.min(steps, Math.abs(dx));
    let futureY = entities.base.y + Math.sign(dy) * Math.min(steps, Math.abs(dy));
    
    // 确保在地图范围内
    futureX = Math.max(0, Math.min(CONFIG.MAP_SIZE - CONFIG.BASE_SIZE, futureX));
    futureY = Math.max(0, Math.min(CONFIG.MAP_SIZE - CONFIG.BASE_SIZE, futureY));
    
    return {x: futureX, y: futureY};
}

// 判断是否为战略位置
function isStrategicPosition(x, y) {
    // 检查是否靠近目标点
    for (let target of entities.targets) {
        let distance = Math.abs(x - target.x) + Math.abs(y - target.y);
        if (distance <= 5) return true;
    }
    
    // 检查是否在地图中心区域
    let centerX = CONFIG.MAP_SIZE / 2;
    let centerY = CONFIG.MAP_SIZE / 2;
    let centerDistance = Math.abs(x - centerX) + Math.abs(y - centerY);
    if (centerDistance <= 10) return true;
    
    return false;
}

// 判断是否为瓶颈位置
function isBottleneckPosition(x, y) {
    // 检查周围是否有很多墙壁，形成瓶颈
    let wallCount = 0;
    let checkRadius = 3;
    
    for (let dy = -checkRadius; dy <= checkRadius; dy++) {
        for (let dx = -checkRadius; dx <= checkRadius; dx++) {
            let checkX = x + dx;
            let checkY = y + dy;
            
            if (checkX >= 0 && checkX < CONFIG.MAP_SIZE && 
                checkY >= 0 && checkY < CONFIG.MAP_SIZE) {
                if (gameMap[checkY][checkX] === TILE.WALL) {
                    wallCount++;
                }
            }
        }
    }
    
    // 如果周围墙壁密度高，认为是瓶颈位置
    let totalCells = (checkRadius * 2 + 1) * (checkRadius * 2 + 1);
    let wallDensity = wallCount / totalCells;
    
    return wallDensity > 0.6; // 60%以上是墙壁
}

// 计算围堵位置
function calculateSurroundPosition(pursuer) {
    let pursuerIndex = entities.pursuers.indexOf(pursuer);
    let surroundRadius = 8;
    
    // 在基地周围形成包围圈
    let angle = (pursuerIndex % 8) * (Math.PI * 2 / 8); // 8个方向
    let targetX = entities.base.x + Math.floor(Math.cos(angle) * surroundRadius);
    let targetY = entities.base.y + Math.floor(Math.sin(angle) * surroundRadius);
    
    // 确保目标位置在地图内
    targetX = Math.max(0, Math.min(CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE, targetX));
    targetY = Math.max(0, Math.min(CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE, targetY));
    
    return {x: targetX, y: targetY};
}

// 移动追兵到指定位置
function movePursuerToPosition(pursuer, targetPos, currentTime) {
    // 如果追兵没有路径或目标改变，重新计算路径
    if (!pursuer.path || pursuer.path.length <= 1 || 
        !pursuer.lastTarget || 
        pursuer.lastTarget.x !== targetPos.x || 
        pursuer.lastTarget.y !== targetPos.y) {
        
        let path = findPath(pursuer.x, pursuer.y, targetPos.x, targetPos.y, CONFIG.PURSUER_SIZE, CONFIG.PURSUER_SIZE);
        if (path && path.length > 1) {
            pursuer.path = path;
            pursuer.lastTarget = {x: targetPos.x, y: targetPos.y};
        } else {
            // A*失败，使用简化的移动逻辑
            movePursuerSimple(pursuer, currentTime);
            return;
        }
    }
    
    // 沿着路径移动
    if (pursuer.path && pursuer.path.length > 1) {
        pursuer.path.shift(); // 移除当前位置
        if (pursuer.path.length > 0) {
            let nextPos = pursuer.path[0];
            // 检查下一个位置是否仍然有效
            if (isPositionValidForPursuer(nextPos.x, nextPos.y, pursuer.id)) {
                pursuer.x = nextPos.x;
                pursuer.y = nextPos.y;
            } else {
                // 路径被阻塞，清除路径以便重新计算
                pursuer.path = [];
                console.log(`追兵${pursuer.id}的路径被阻塞，将重新计算路径`);
            }
        }
    }
    
    pursuer.lastMoveTime = currentTime;
}

// 简化的追兵移动逻辑（备用）
function movePursuerSimple(pursuer, currentTime) {
    let dx = entities.base.x - pursuer.x;
    let dy = entities.base.y - pursuer.y;
    
    // 尝试多个移动方向，避免卡住
    let moves = [];
    
    // 主要移动方向
    if (Math.abs(dx) > Math.abs(dy)) {
        moves.push({x: dx > 0 ? 1 : -1, y: 0});
        moves.push({x: 0, y: dy > 0 ? 1 : -1});
    } else {
        moves.push({x: 0, y: dy > 0 ? 1 : -1});
        moves.push({x: dx > 0 ? 1 : -1, y: 0});
    }
    
    // 添加对角线移动
    moves.push({x: dx > 0 ? 1 : -1, y: dy > 0 ? 1 : -1});
    
    // 添加所有8个方向作为备选
    let allDirections = [
        {x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1},
        {x: 1, y: 1}, {x: 1, y: -1}, {x: -1, y: 1}, {x: -1, y: -1}
    ];
    moves.push(...allDirections);
    
    // 尝试每个移动方向
    let moved = false;
    for (let move of moves) {
        let newX = pursuer.x + move.x;
        let newY = pursuer.y + move.y;
        
        if (isPositionValidForPursuer(newX, newY, pursuer.id)) {
            pursuer.x = newX;
            pursuer.y = newY;
            moved = true;
            break;
        }
    }
    
    // 如果无法移动，记录日志
    if (!moved) {
        console.log(`追兵${pursuer.id}在(${pursuer.x}, ${pursuer.y})完全被困住了`);
    }
    
    pursuer.lastMoveTime = currentTime;
}

// 评估冲击波威胁
function evaluateShockwaveThreat(pursuer, currentTime) {
    let threat = {
        shouldEvade: false,
        timeUntilShockwave: 0,
        distanceToBase: 0,
        safeDistance: CONFIG.SHOCKWAVE_RANGE + 2 // 冲击波范围+2格的安全距离
    };
    
    // 计算距离基地的距离
    let pursuerCenter = {
        x: pursuer.x + Math.floor(CONFIG.PURSUER_SIZE / 2),
        y: pursuer.y + Math.floor(CONFIG.PURSUER_SIZE / 2)
    };
    let baseCenter = {
        x: entities.base.x + Math.floor(CONFIG.BASE_SIZE / 2),
        y: entities.base.y + Math.floor(CONFIG.BASE_SIZE / 2)
    };
    
    threat.distanceToBase = Math.max(
        Math.abs(pursuerCenter.x - baseCenter.x),
        Math.abs(pursuerCenter.y - baseCenter.y)
    );
    
    // 计算距离下次冲击波的时间
    let timeSinceLastShockwave = currentTime - entities.base.lastShockwaveTime;
    let shockwaveInterval = CONFIG.SHOCKWAVE_INTERVAL / gameState.speedMultiplier;
    threat.timeUntilShockwave = Math.max(0, shockwaveInterval - timeSinceLastShockwave);
    
    // 如果在危险范围内且冲击波即将释放，需要逃脱
    if (threat.distanceToBase <= CONFIG.SHOCKWAVE_RANGE && threat.timeUntilShockwave < 2000 / gameState.speedMultiplier) {
        threat.shouldEvade = true;
        console.log(`追兵 ${pursuer.id} 检测到冲击波威胁，距离基地${threat.distanceToBase}格，${(threat.timeUntilShockwave/1000).toFixed(1)}秒后冲击波`);
    }
    
    return threat;
}

// 计算逃脱位置
function calculateEvadePosition(pursuer, threat) {
    let baseCenter = {
        x: entities.base.x + Math.floor(CONFIG.BASE_SIZE / 2),
        y: entities.base.y + Math.floor(CONFIG.BASE_SIZE / 2)
    };
    
    // 计算远离基地的方向
    let dx = pursuer.x - baseCenter.x;
    let dy = pursuer.y - baseCenter.y;
    
    // 标准化方向
    let length = Math.sqrt(dx * dx + dy * dy);
    if (length > 0) {
        dx /= length;
        dy /= length;
    } else {
        // 如果重合，随机选择方向
        dx = Math.random() - 0.5;
        dy = Math.random() - 0.5;
    }
    
    // 逃到安全距离外
    let escapeDistance = threat.safeDistance + 2;
    let targetX = Math.floor(baseCenter.x + dx * escapeDistance);
    let targetY = Math.floor(baseCenter.y + dy * escapeDistance);
    
    // 确保在地图范围内
    targetX = Math.max(0, Math.min(CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE, targetX));
    targetY = Math.max(0, Math.min(CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE, targetY));
    
    return {x: targetX, y: targetY};
}

// 计算骚扰位置（保持安全距离）
function calculateHarassPosition(pursuer, threat) {
    let baseCenter = {
        x: entities.base.x + Math.floor(CONFIG.BASE_SIZE / 2),
        y: entities.base.y + Math.floor(CONFIG.BASE_SIZE / 2)
    };
    
    // 如果有冲击波威胁，优先逃脱
    if (threat.shouldEvade) {
        return calculateEvadePosition(pursuer, threat);
    }
    
    // 保持在攻击范围内但冲击波范围外
    let optimalDistance = CONFIG.SHOCKWAVE_RANGE + 1; // 刚好在冲击波范围外
    let pursuerIndex = entities.pursuers.indexOf(pursuer);
    
    // 在基地周围形成外围骚扰圈
    let angle = (pursuerIndex % 12) * (Math.PI * 2 / 12); // 12个方向
    let targetX = baseCenter.x + Math.floor(Math.cos(angle) * optimalDistance);
    let targetY = baseCenter.y + Math.floor(Math.sin(angle) * optimalDistance);
    
    // 确保在地图范围内
    targetX = Math.max(0, Math.min(CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE, targetX));
    targetY = Math.max(0, Math.min(CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE, targetY));
    
    return {x: targetX, y: targetY};
}

// 选择最安全的目标点（仅在到达当前目标后使用）
function selectSafestTarget() {
    let safestTarget = -1;
    let bestScore = -1;
    
    for (let i = 0; i < entities.targets.length; i++) {
        let target = entities.targets[i];
        let score = evaluateTargetSafety(target, i);
        
        if (score > bestScore) {
            bestScore = score;
            safestTarget = i;
        }
    }
    
    return safestTarget;
}

// 评估目标点的安全性
function evaluateTargetSafety(target, targetIndex) {
    let score = 100; // 基础分数
    
    // 计算到目标的距离（距离越近越好）
    let distanceToTarget = Math.abs(entities.base.x - target.x) + Math.abs(entities.base.y - target.y);
    score -= distanceToTarget * 0.1;
    
    // 计算追兵威胁度
    for (let pursuer of entities.pursuers) {
        let pursuerToTarget = Math.abs(pursuer.x - target.x) + Math.abs(pursuer.y - target.y);
        let pursuerToBase = Math.abs(pursuer.x - entities.base.x) + Math.abs(pursuer.y - entities.base.y);
        
        // 如果追兵距离目标很近，降低分数
        if (pursuerToTarget < 15) {
            score -= (15 - pursuerToTarget) * 2;
        }
        
        // 如果追兵在基地和目标之间，降低分数
        if (pursuerToTarget < distanceToTarget && pursuerToBase < distanceToTarget) {
            score -= 10;
        }
    }
    
    // 避免重复选择当前目标（鼓励移动）
    if (targetIndex === entities.base.targetIndex) {
        score -= 5;
    }
    
    return score;
}

// 通过中间点查找路径
function findPathViaWaypoints(startX, startY, endX, endY) {
    // 生成几个潜在的中间点
    let waypoints = generateWaypoints(startX, startY, endX, endY);
    
    for (let waypoint of waypoints) {
        // 尝试通过这个中间点到达目标（使用基地专用寻路）
        let pathToWaypoint = findPathForBase(startX, startY, waypoint.x, waypoint.y);
        if (pathToWaypoint && pathToWaypoint.length > 1) {
            let pathFromWaypoint = findPathForBase(waypoint.x, waypoint.y, endX, endY);
            if (pathFromWaypoint && pathFromWaypoint.length > 1) {
                // 合并两段路径
                let combinedPath = pathToWaypoint.concat(pathFromWaypoint.slice(1)); // 去除重复的中间点
                console.log(`通过中间点(${waypoint.x}, ${waypoint.y})找到路径，长度: ${combinedPath.length}`);
                return combinedPath;
            }
        }
    }
    
    return null;
}

// 生成中间点候选
function generateWaypoints(startX, startY, endX, endY) {
    let waypoints = [];
    
    // 地图中心点
    let centerX = Math.floor(CONFIG.MAP_SIZE / 2);
    let centerY = Math.floor(CONFIG.MAP_SIZE / 2);
    waypoints.push({x: centerX, y: centerY});
    
    // 四个象限的中心点
    let quarterX = Math.floor(CONFIG.MAP_SIZE / 4);
    let threeQuarterX = Math.floor(CONFIG.MAP_SIZE * 3 / 4);
    let quarterY = Math.floor(CONFIG.MAP_SIZE / 4);
    let threeQuarterY = Math.floor(CONFIG.MAP_SIZE * 3 / 4);
    
    waypoints.push({x: quarterX, y: quarterY});
    waypoints.push({x: threeQuarterX, y: quarterY});
    waypoints.push({x: quarterX, y: threeQuarterY});
    waypoints.push({x: threeQuarterX, y: threeQuarterY});
    
    // 中点路径（先水平再垂直，或先垂直再水平）
    waypoints.push({x: endX, y: startY}); // L型路径1
    waypoints.push({x: startX, y: endY}); // L型路径2
    
    // 过滤掉无效的中间点
    return waypoints.filter(wp => 
        wp.x >= 0 && wp.x <= CONFIG.MAP_SIZE - CONFIG.BASE_SIZE &&
        wp.y >= 0 && wp.y <= CONFIG.MAP_SIZE - CONFIG.BASE_SIZE &&
        isPositionValidForBaseMovement(wp.x, wp.y)
    );
}

// 边缘绕行路径
function findEdgePath(startX, startY, endX, endY) {
    // 尝试沿着地图边缘移动
    let edgeWaypoints = [
        {x: 5, y: 5}, // 左上角附近
        {x: CONFIG.MAP_SIZE - CONFIG.BASE_SIZE - 5, y: 5}, // 右上角附近
        {x: CONFIG.MAP_SIZE - CONFIG.BASE_SIZE - 5, y: CONFIG.MAP_SIZE - CONFIG.BASE_SIZE - 5}, // 右下角附近
        {x: 5, y: CONFIG.MAP_SIZE - CONFIG.BASE_SIZE - 5} // 左下角附近
    ];
    
    // 选择距离目标最近的边缘点作为中间点
    let bestWaypoint = null;
    let minDistance = Infinity;
    
    for (let waypoint of edgeWaypoints) {
        if (isPositionValidForBaseMovement(waypoint.x, waypoint.y)) {
            let distance = Math.abs(waypoint.x - endX) + Math.abs(waypoint.y - endY);
            if (distance < minDistance) {
                minDistance = distance;
                bestWaypoint = waypoint;
            }
        }
    }
    
    if (bestWaypoint) {
        let pathToEdge = findPathForBase(startX, startY, bestWaypoint.x, bestWaypoint.y);
        if (pathToEdge && pathToEdge.length > 1) {
            let pathFromEdge = findPathForBase(bestWaypoint.x, bestWaypoint.y, endX, endY);
            if (pathFromEdge && pathFromEdge.length > 1) {
                return pathToEdge.concat(pathFromEdge.slice(1));
            }
        }
    }
    
    return null;
}

// 基地专用寻路函数（允许通过追兵，因为可以碾压）
function findPathForBase(startX, startY, endX, endY) {
    // 检查目标位置是否有效
    if (!isPositionValidForBase(endX, endY)) {
        return null;
    }
    
    let openList = [new PathNode(startX, startY, 0, heuristic(startX, startY, endX, endY))];
    let closedList = new Set();
    let openMap = new Map();
    openMap.set(`${startX},${startY}`, openList[0]);
    
    const directions = [
        {dx: 0, dy: -1}, {dx: 1, dy: 0}, {dx: 0, dy: 1}, {dx: -1, dy: 0}
    ];
    
    while (openList.length > 0) {
        openList.sort((a, b) => a.f - b.f);
        let current = openList.shift();
        openMap.delete(`${current.x},${current.y}`);
        
        let currentKey = `${current.x},${current.y}`;
        closedList.add(currentKey);
        
        // 到达目标
        if (Math.abs(current.x - endX) < CONFIG.BASE_SIZE && Math.abs(current.y - endY) < CONFIG.BASE_SIZE) {
            let path = [];
            let node = current;
            while (node) {
                path.unshift({x: node.x, y: node.y});
                node = node.parent;
            }
            return path;
        }
        
        // 探索邻居
        for (let dir of directions) {
            let nx = current.x + dir.dx;
            let ny = current.y + dir.dy;
            let neighborKey = `${nx},${ny}`;
            
            if (closedList.has(neighborKey)) continue;
            
            // 使用基地专用的位置验证（允许通过追兵）
            if (!isPositionValidForBase(nx, ny)) continue;
            
            let g = current.g + 1;
            let h = heuristic(nx, ny, endX, endY);
            let f = g + h;
            
            let existingNode = openMap.get(neighborKey);
            if (!existingNode || g < existingNode.g) {
                let newNode = new PathNode(nx, ny, g, h, current);
                if (existingNode) {
                    existingNode.g = g;
                    existingNode.h = h;
                    existingNode.f = f;
                    existingNode.parent = current;
                } else {
                    openList.push(newNode);
                    openMap.set(neighborKey, newNode);
                }
            }
        }
    }
    
    return null;
}

// 忽略追兵的路径查找
function findPathIgnoringPursuers(startX, startY, endX, endY) {
    // 使用特殊的寻路函数，只考虑墙壁，不考虑追兵
    return findPathOnlyWalls(startX, startY, endX, endY, CONFIG.BASE_SIZE, CONFIG.BASE_SIZE);
}

// 只考虑墙壁的A*寻路
function findPathOnlyWalls(startX, startY, endX, endY, entityWidth = 1, entityHeight = 1) {
    if (!isPositionValidOnlyWalls(endX, endY, entityWidth, entityHeight)) {
        return null;
    }
    
    let openList = [new PathNode(startX, startY, 0, heuristic(startX, startY, endX, endY))];
    let closedList = new Set();
    let openMap = new Map();
    openMap.set(`${startX},${startY}`, openList[0]);
    
    const directions = [
        {dx: 0, dy: -1}, {dx: 1, dy: 0}, {dx: 0, dy: 1}, {dx: -1, dy: 0}
    ];
    
    while (openList.length > 0) {
        openList.sort((a, b) => a.f - b.f);
        let current = openList.shift();
        openMap.delete(`${current.x},${current.y}`);
        
        let currentKey = `${current.x},${current.y}`;
        closedList.add(currentKey);
        
        if (Math.abs(current.x - endX) < entityWidth && Math.abs(current.y - endY) < entityHeight) {
            let path = [];
            let node = current;
            while (node) {
                path.unshift({x: node.x, y: node.y});
                node = node.parent;
            }
            return path;
        }
        
        for (let dir of directions) {
            let nx = current.x + dir.dx;
            let ny = current.y + dir.dy;
            let neighborKey = `${nx},${ny}`;
            
            if (closedList.has(neighborKey)) continue;
            if (!isPositionValidOnlyWalls(nx, ny, entityWidth, entityHeight)) continue;
            
            let g = current.g + 1;
            let h = heuristic(nx, ny, endX, endY);
            let f = g + h;
            
            let existingNode = openMap.get(neighborKey);
            if (!existingNode || g < existingNode.g) {
                let newNode = new PathNode(nx, ny, g, h, current);
                if (existingNode) {
                    existingNode.g = g;
                    existingNode.h = h;
                    existingNode.f = f;
                    existingNode.parent = current;
                } else {
                    openList.push(newNode);
                    openMap.set(neighborKey, newNode);
                }
            }
        }
    }
    
    return null;
}

// 只检查墙壁的位置验证
function isPositionValidOnlyWalls(x, y, width, height) {
    if (x < 0 || y < 0 || x + width > CONFIG.MAP_SIZE || y + height > CONFIG.MAP_SIZE) {
        return false;
    }
    
    for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
            if (gameMap[y + dy][x + dx] === TILE.WALL) {
                return false;
            }
        }
    }
    
    return true;
}

// 智能路径查找 - 多种策略尝试
function findOptimalPath(startX, startY, endX, endY) {
    console.log(`开始为基地规划从(${startX}, ${startY})到(${endX}, ${endY})的路径`);
    
    // 策略1: 直接路径（基地专用寻路，允许通过追兵）
    let directPath = findPathForBase(startX, startY, endX, endY);
    if (directPath && directPath.length > 1) {
        console.log(`✅ 找到基地直接路径，长度: ${directPath.length}，可以碾压追兵`);
        return directPath;
    } else {
        console.log(`❌ 无法找到基地直接路径，尝试其他策略`);
    }
    
    // 策略2: 通过中间点的多段路径
    let waypointPath = findPathViaWaypoints(startX, startY, endX, endY);
    if (waypointPath && waypointPath.length > 1) {
        console.log(`✅ 找到中间点路径，长度: ${waypointPath.length}`);
        return waypointPath;
    }
    
    // 策略3: 边缘绕行路径
    let edgePath = findEdgePath(startX, startY, endX, endY);
    if (edgePath && edgePath.length > 1) {
        console.log(`✅ 找到边缘绕行路径，长度: ${edgePath.length}`);
        return edgePath;
    }
    
    // 策略4: 强制路径（忽略追兵，只考虑墙壁）
    let forcePath = findPathIgnoringPursuers(startX, startY, endX, endY);
    if (forcePath && forcePath.length > 1) {
        console.log(`✅ 找到强制路径（忽略追兵），长度: ${forcePath.length}`);
        return forcePath;
    }
    
    // 所有策略都失败，返回直接路径（如果存在）或null
    console.log(`⚠️ 所有路径策略都失败，返回直接路径或null`);
    return directPath;
}

// 带追兵规避的路径查找（保留原有功能）
function findPathWithPursuerAvoidance(startX, startY, endX, endY) {
    // 首先尝试普通A*路径
    let path = findPath(startX, startY, endX, endY, CONFIG.BASE_SIZE, CONFIG.BASE_SIZE);
    
    if (!path) return null;
    
    // 评估路径的危险性
    let dangerScore = evaluatePathDanger(path);
    
    // 如果路径太危险，尝试寻找更安全的路径
    if (dangerScore > 50) {
        console.log(`基地路径危险度: ${dangerScore}，寻找更安全路径`);
        // 可以在这里实现更复杂的规避算法
        // 暂时返回原路径，让基地自己应对
    }
    
    return path;
}

// 评估路径的危险性
function evaluatePathDanger(path) {
    let danger = 0;
    
    for (let i = 0; i < path.length; i++) {
        let point = path[i];
        
        // 检查路径点周围的追兵威胁
        for (let pursuer of entities.pursuers) {
            let distance = Math.abs(point.x - pursuer.x) + Math.abs(point.y - pursuer.y);
            
            if (distance < 8) {
                danger += 10 - distance;
            }
        }
    }
    
    return danger;
}

// 检测紧急威胁
function detectEmergencyThreat() {
    let threat = {
        isEmergency: false,
        threatLevel: 0,
        escapeDirection: null,
        threateningPursuers: []
    };
    
    let nearbyPursuers = [];
    let veryClosePursuers = [];
    
    // 检查周围的追兵
    for (let pursuer of entities.pursuers) {
        let distance = Math.abs(entities.base.x - pursuer.x) + Math.abs(entities.base.y - pursuer.y);
        
        if (distance <= 12) {
            nearbyPursuers.push({pursuer: pursuer, distance: distance});
            if (distance <= 6) {
                veryClosePursuers.push({pursuer: pursuer, distance: distance});
            }
        }
    }
    
    // 判断威胁等级
    if (veryClosePursuers.length >= 2 || nearbyPursuers.length >= 4) {
        threat.isEmergency = true;
        threat.threatLevel = veryClosePursuers.length * 3 + nearbyPursuers.length;
        threat.threateningPursuers = nearbyPursuers;
        threat.escapeDirection = calculateBestEscapeDirection(nearbyPursuers);
        console.log(`检测到紧急威胁！威胁等级: ${threat.threatLevel}`);
    }
    
    return threat;
}

// 计算最佳逃脱方向
function calculateBestEscapeDirection(nearbyPursuers) {
    let directions = [
        {dx: 0, dy: -1, name: '北'}, {dx: 1, dy: -1, name: '东北'},
        {dx: 1, dy: 0, name: '东'}, {dx: 1, dy: 1, name: '东南'},
        {dx: 0, dy: 1, name: '南'}, {dx: -1, dy: 1, name: '西南'},
        {dx: -1, dy: 0, name: '西'}, {dx: -1, dy: -1, name: '西北'}
    ];
    
    let bestDirection = null;
    let bestScore = -1000;
    
    for (let dir of directions) {
        let score = 0;
        let testX = entities.base.x + dir.dx * 10; // 测试10格外的位置
        let testY = entities.base.y + dir.dy * 10;
        
        // 检查方向是否可行
        if (testX < 0 || testX >= CONFIG.MAP_SIZE - CONFIG.BASE_SIZE || 
            testY < 0 || testY >= CONFIG.MAP_SIZE - CONFIG.BASE_SIZE) {
            continue; // 超出边界
        }
        
        // 计算这个方向远离追兵的程度
        for (let item of nearbyPursuers) {
            let pursuer = item.pursuer;
            let newDistance = Math.abs(testX - pursuer.x) + Math.abs(testY - pursuer.y);
            let currentDistance = Math.abs(entities.base.x - pursuer.x) + Math.abs(entities.base.y - pursuer.y);
            score += (newDistance - currentDistance) * 2; // 距离增加得分
        }
        
        // 偏好朝向地图中心移动（避免被逼到角落）
        let centerX = CONFIG.MAP_SIZE / 2;
        let centerY = CONFIG.MAP_SIZE / 2;
        let currentDistanceToCenter = Math.abs(entities.base.x - centerX) + Math.abs(entities.base.y - centerY);
        let newDistanceToCenter = Math.abs(testX - centerX) + Math.abs(testY - centerY);
        if (newDistanceToCenter < currentDistanceToCenter) {
            score += 5; // 朝向中心加分
        }
        
        if (score > bestScore) {
            bestScore = score;
            bestDirection = dir;
        }
    }
    
    return bestDirection;
}

// 处理紧急逃脱
function handleEmergencyEscape(threat, currentTime) {
    if (!entities.base.emergencyMode) {
        entities.base.emergencyMode = true;
        entities.base.emergencyStartTime = currentTime;
        entities.base.crushTargets.clear(); // 紧急逃脱时取消所有碾压
        console.log('基地进入紧急逃脱模式！');
    }
    
    // 计算逃脱目标位置
    let escapeTarget = null;
    
    if (threat.escapeDirection) {
        // 朝最佳逃脱方向移动更远
        let escapeDistance = 20 + threat.threatLevel; // 威胁越高逃得越远
        escapeTarget = {
            x: Math.max(0, Math.min(CONFIG.MAP_SIZE - CONFIG.BASE_SIZE, 
                entities.base.x + threat.escapeDirection.dx * escapeDistance)),
            y: Math.max(0, Math.min(CONFIG.MAP_SIZE - CONFIG.BASE_SIZE, 
                entities.base.y + threat.escapeDirection.dy * escapeDistance))
        };
        console.log(`基地朝${threat.escapeDirection.name}方向逃脱到 (${escapeTarget.x}, ${escapeTarget.y})`);
    } else {
        // 如果没有好的逃脱方向，尝试朝地图中心移动
        escapeTarget = {
            x: Math.floor(CONFIG.MAP_SIZE / 2),
            y: Math.floor(CONFIG.MAP_SIZE / 2)
        };
        console.log('基地朝地图中心逃脱');
    }
    
    // 尝试找到逃脱路径
    if (escapeTarget) {
        let escapePath = findPath(entities.base.x, entities.base.y, escapeTarget.x, escapeTarget.y, 
                                 CONFIG.BASE_SIZE, CONFIG.BASE_SIZE);
        if (escapePath && escapePath.length > 1) {
            entities.base.path = escapePath;
            entities.base.lastMoveTime = currentTime;
        } else {
            // 如果无法找到逃脱路径，尝试任意可移动的方向
            tryEmergencyMovement(currentTime);
        }
    }
}

// 尝试紧急移动
function tryEmergencyMovement(currentTime) {
    let directions = [
        {dx: 0, dy: -2}, {dx: 2, dy: 0}, {dx: 0, dy: 2}, {dx: -2, dy: 0},
        {dx: 1, dy: -1}, {dx: 1, dy: 1}, {dx: -1, dy: 1}, {dx: -1, dy: -1}
    ];
    
    for (let dir of directions) {
        let newX = entities.base.x + dir.dx;
        let newY = entities.base.y + dir.dy;
        
        if (isPositionValidForBase(newX, newY)) {
            entities.base.x = newX;
            entities.base.y = newY;
            entities.base.lastMoveTime = currentTime;
            console.log(`基地紧急移动到 (${newX}, ${newY})`);
            break;
        }
    }
}



// 尝试朝目标方向应急移动
function tryEmergencyMovementToTarget(currentTime) {
    let target = entities.targets[entities.base.targetIndex];
    if (!target) return;
    
    // 计算朝目标的大致方向
    let dx = target.x - entities.base.x;
    let dy = target.y - entities.base.y;
    
    // 标准化方向
    let moveX = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
    let moveY = dy > 0 ? 1 : (dy < 0 ? -1 : 0);
    
    // 尝试各种移动方向，优先朝目标方向
    let directions = [
        {dx: moveX, dy: moveY}, // 对角线朝目标
        {dx: moveX, dy: 0},     // 水平朝目标
        {dx: 0, dy: moveY},     // 垂直朝目标
        {dx: moveX, dy: -moveY}, // 其他方向
        {dx: -moveX, dy: moveY},
        {dx: -moveX, dy: 0},
        {dx: 0, dy: -moveY},
        {dx: -moveX, dy: -moveY}
    ];
    
    for (let dir of directions) {
        let newX = entities.base.x + dir.dx;
        let newY = entities.base.y + dir.dy;
        
        if (isPositionValidForBaseMovement(newX, newY)) {
            entities.base.x = newX;
            entities.base.y = newY;
            entities.base.lastMoveTime = currentTime;
            console.log(`基地应急移动到 (${newX}, ${newY})，继续朝目标${entities.base.targetIndex + 1}前进`);
            break;
        }
    }
}

// 应急寻路策略
function tryEmergencyPathfinding(currentTime) {
    let target = entities.targets[entities.base.targetIndex];
    if (!target) return false;
    
    console.log(`🚨 启动应急寻路策略，目标: (${target.x}, ${target.y})`);
    
    // 策略1: 尝试临时改变目标到最近的可达目标
    let alternativeTarget = findNearestReachableTarget();
    if (alternativeTarget !== -1 && alternativeTarget !== entities.base.targetIndex) {
        console.log(`📍 临时切换到最近可达目标: ${alternativeTarget + 1}`);
        let tempPath = findPathForBase(entities.base.x, entities.base.y, 
            entities.targets[alternativeTarget].x, entities.targets[alternativeTarget].y);
        if (tempPath && tempPath.length > 1) {
            entities.base.path = tempPath;
            entities.base.temporaryTarget = entities.base.targetIndex; // 记录原目标
            entities.base.targetIndex = alternativeTarget; // 临时切换目标
            entities.base.pathfindingFailures = 0; // 重置失败计数
            return true;
        }
    }
    
    // 策略2: 尝试移动到地图中心然后重新计算
    let centerX = Math.floor(CONFIG.MAP_SIZE / 2);
    let centerY = Math.floor(CONFIG.MAP_SIZE / 2);
    let centerPath = findPathForBase(entities.base.x, entities.base.y, centerX, centerY);
    if (centerPath && centerPath.length > 1) {
        console.log(`🎯 基地先移动到地图中心`);
        entities.base.path = centerPath;
        entities.base.emergencyMode = true;
        entities.base.pathfindingFailures = 0; // 重置失败计数
        return true;
    }
    
    // 策略3: 尝试随机移动脱困
    if (tryRandomMovement(currentTime)) {
        console.log(`🎲 基地使用随机移动脱困`);
        return true;
    }
    
    console.log(`💀 所有应急策略都失败了`);
    return false;
}

// 查找最近的可达目标
function findNearestReachableTarget() {
    let minDistance = Infinity;
    let nearestTarget = -1;
    
    for (let i = 0; i < entities.targets.length; i++) {
        if (i === entities.base.targetIndex) continue; // 跳过当前目标
        
        let target = entities.targets[i];
        let distance = Math.abs(entities.base.x - target.x) + Math.abs(entities.base.y - target.y);
        
        // 快速检查是否可能到达（使用基地专用寻路）
        let quickPath = findPathForBase(entities.base.x, entities.base.y, target.x, target.y);
        
        if (quickPath && quickPath.length > 1 && distance < minDistance) {
            minDistance = distance;
            nearestTarget = i;
        }
    }
    
    return nearestTarget;
}

// 尝试随机移动
function tryRandomMovement(currentTime) {
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts) {
        // 生成随机方向
        let dx = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
        let dy = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
        
        if (dx === 0 && dy === 0) continue; // 跳过不移动的情况
        
        let newX = entities.base.x + dx;
        let newY = entities.base.y + dy;
        
        if (isPositionValidForBaseMovement(newX, newY)) {
            entities.base.x = newX;
            entities.base.y = newY;
            entities.base.lastMoveTime = currentTime;
            entities.base.pathfindingFailures = 0; // 重置失败计数
            console.log(`🎲 基地随机移动到 (${newX}, ${newY})`);
            return true;
        }
        
        attempts++;
    }
    
    return false;
}

// 获取阻挡基地的追兵
function getBlockingPursuer(targetX, targetY) {
    for (let pursuer of entities.pursuers) {
        // 检查追兵是否与基地目标位置重叠
        if (!(targetX + CONFIG.BASE_SIZE <= pursuer.x || 
              targetX >= pursuer.x + pursuer.width ||
              targetY + CONFIG.BASE_SIZE <= pursuer.y || 
              targetY >= pursuer.y + pursuer.height)) {
            return pursuer;
        }
    }
    return null;
}

// 处理基地碾压追兵
function handleBaseCrush(pursuer, currentTime) {
    if (!entities.base.crushTargets.has(pursuer.id)) {
        // 开始碾压这个追兵
        entities.base.crushTargets.set(pursuer.id, currentTime);
        console.log(`基地开始碾压追兵 ${pursuer.id}`);
    }
}

// 处理碾压目标
function processCrushTargets(currentTime) {
    for (let [pursuerId, startTime] of entities.base.crushTargets) {
        if (currentTime - startTime >= CONFIG.CRUSH_TIME / gameState.speedMultiplier) {
            // 碾压时间到，杀死追兵
            crushPursuer(pursuerId);
            entities.base.crushTargets.delete(pursuerId);
        }
    }
}

// 碾压追兵（杀死并复活）
function crushPursuer(pursuerId) {
    let pursuerIndex = entities.pursuers.findIndex(p => p.id === pursuerId);
    if (pursuerIndex !== -1) {
        let pursuer = entities.pursuers[pursuerIndex];
        console.log(`追兵 ${pursuerId} 被基地碾死！`);
        
        // 在地图边缘复活
        respawnPursuer(pursuer);
        
        console.log(`追兵 ${pursuerId} 在地图边缘复活到 (${pursuer.x}, ${pursuer.y})`);
    }
}

// 在地图边缘复活追兵
function respawnPursuer(pursuer) {
    let respawnAttempts = 0;
    let maxAttempts = 100;
    
    while (respawnAttempts < maxAttempts) {
        let side = Math.floor(Math.random() * 4); // 0=上, 1=右, 2=下, 3=左
        let x, y;
        
        switch (side) {
            case 0: // 上边缘
                x = Math.floor(Math.random() * (CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE));
                y = 1;
                break;
            case 1: // 右边缘
                x = CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE - 1;
                y = Math.floor(Math.random() * (CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE));
                break;
            case 2: // 下边缘
                x = Math.floor(Math.random() * (CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE));
                y = CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE - 1;
                break;
            case 3: // 左边缘
                x = 1;
                y = Math.floor(Math.random() * (CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE));
                break;
        }
        
        // 检查位置是否有效
        if (isPositionValidForPursuer(x, y, pursuer.id)) {
            pursuer.x = x;
            pursuer.y = y;
            resetPursuerState(pursuer);
            return;
        }
        
        respawnAttempts++;
    }
    
    // 如果边缘都找不到位置，就放在地图中心附近的空地
    console.warn(`追兵 ${pursuer.id} 无法在边缘复活，放置在地图中心附近`);
    let centerPos = findValidPositionExcluding(CONFIG.PURSUER_SIZE, CONFIG.PURSUER_SIZE, 
                                               [entities.base, ...entities.altars, ...entities.targets]);
    if (centerPos) {
        pursuer.x = centerPos.x;
        pursuer.y = centerPos.y;
        resetPursuerState(pursuer);
    }
}

// 检查基地移动位置是否有效（不考虑追兵碰撞）
function isPositionValidForBaseMovement(x, y) {
    // 检查地图边界
    if (x < 0 || y < 0 || x + CONFIG.BASE_SIZE > CONFIG.MAP_SIZE || y + CONFIG.BASE_SIZE > CONFIG.MAP_SIZE) {
        return false;
    }
    
    // 检查是否与墙碰撞
    for (let dy = 0; dy < CONFIG.BASE_SIZE; dy++) {
        for (let dx = 0; dx < CONFIG.BASE_SIZE; dx++) {
            if (gameMap[y + dy][x + dx] === TILE.WALL) {
                return false;
            }
        }
    }
    
    // 不检查追兵碰撞，因为基地可以碾压追兵
    return true;
}

// 处理冲击波 - 无条件每5秒释放
function processShockwave(currentTime) {
    if (!entities.base) return;
    
    // 初始化冲击波时间（如果还没有设置）
    if (entities.base.lastShockwaveTime === 0) {
        entities.base.lastShockwaveTime = currentTime;
    }
    
    // 计算时间间隔
    let timeSinceLastShockwave = currentTime - entities.base.lastShockwaveTime;
    let shockwaveInterval = CONFIG.SHOCKWAVE_INTERVAL / gameState.speedMultiplier;
    
    // 无条件检查是否需要释放冲击波
    if (timeSinceLastShockwave >= shockwaveInterval) {
        releaseShockwave(currentTime);
        console.log(`强制冲击波释放：间隔${timeSinceLastShockwave}ms，应该间隔${shockwaveInterval}ms`);
    }
    
    // 检查冲击波动画是否结束
    if (entities.base.shockwaveActive && 
        currentTime - entities.base.shockwaveStartTime >= CONFIG.SHOCKWAVE_ANIMATION_TIME / gameState.speedMultiplier) {
        entities.base.shockwaveActive = false;
    }
}

// 释放冲击波
function releaseShockwave(currentTime) {
    entities.base.lastShockwaveTime = currentTime;
    entities.base.shockwaveActive = true;
    entities.base.shockwaveStartTime = currentTime;
    
    console.log('🌊 基地释放冲击波！');
    
    // 计算冲击波范围内的追兵
    let targetPursuers = [];
    let baseCenter = {
        x: entities.base.x + Math.floor(CONFIG.BASE_SIZE / 2),
        y: entities.base.y + Math.floor(CONFIG.BASE_SIZE / 2)
    };
    
    for (let pursuer of entities.pursuers) {
        let pursuerCenter = {
            x: pursuer.x + Math.floor(CONFIG.PURSUER_SIZE / 2),
            y: pursuer.y + Math.floor(CONFIG.PURSUER_SIZE / 2)
        };
        
        // 检查追兵是否在冲击波范围内
        let distance = Math.max(
            Math.abs(pursuerCenter.x - baseCenter.x),
            Math.abs(pursuerCenter.y - baseCenter.y)
        );
        
        if (distance <= CONFIG.SHOCKWAVE_RANGE) {
            // 记录距离，用于优先级排序
            targetPursuers.push({
                pursuer: pursuer,
                distance: distance
            });
        }
    }
    
    // 按距离排序，优先击杀距离近的追兵
    targetPursuers.sort((a, b) => a.distance - b.distance);
    
    // 限制最大击杀数量
    let killedCount = Math.min(targetPursuers.length, CONFIG.SHOCKWAVE_MAX_KILLS);
    let killedPursuers = targetPursuers.slice(0, killedCount).map(item => item.pursuer);
    
    // 杀死选中的追兵
    for (let pursuer of killedPursuers) {
        console.log(`💥 追兵 ${pursuer.id} 被冲击波击杀！`);
        respawnPursuerAtCorner(pursuer);
    }
    
    if (killedPursuers.length > 0) {
        let totalInRange = targetPursuers.length;
        console.log(`冲击波范围内有 ${totalInRange} 个追兵，击杀了其中 ${killedPursuers.length} 个（最多${CONFIG.SHOCKWAVE_MAX_KILLS}个）`);
    }
}

// 在角落复活追兵
function respawnPursuerAtCorner(pursuer) {
    let corners = [
        {x: 1, y: 1}, // 左上角
        {x: CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE - 1, y: 1}, // 右上角
        {x: 1, y: CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE - 1}, // 左下角
        {x: CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE - 1, y: CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE - 1} // 右下角
    ];
    
    // 随机选择一个角落
    let corner = corners[Math.floor(Math.random() * corners.length)];
    
    // 尝试在角落附近找到空位
    let respawnAttempts = 0;
    let maxAttempts = 50;
    
    while (respawnAttempts < maxAttempts) {
        let offsetX = Math.floor(Math.random() * 10) - 5; // -5到5的偏移
        let offsetY = Math.floor(Math.random() * 10) - 5;
        
        let x = Math.max(1, Math.min(CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE - 1, corner.x + offsetX));
        let y = Math.max(1, Math.min(CONFIG.MAP_SIZE - CONFIG.PURSUER_SIZE - 1, corner.y + offsetY));
        
        if (isPositionValidForPursuer(x, y, pursuer.id)) {
            pursuer.x = x;
            pursuer.y = y;
            resetPursuerState(pursuer);
            console.log(`追兵 ${pursuer.id} 在角落 (${x}, ${y}) 复活`);
            return;
        }
        
        respawnAttempts++;
    }
    
    // 如果角落找不到位置，就在边缘复活
    console.warn(`追兵 ${pursuer.id} 无法在角落复活，使用边缘复活`);
    respawnPursuer(pursuer);
}

// 重置追兵状态
function resetPursuerState(pursuer) {
    pursuer.path = [];
    pursuer.strategy = null;
    pursuer.lastTarget = null;
    pursuer.lastMoveTime = null;
    pursuer.lastAttackTime = 0;
}



// 更新祭坛
function updateAltars(currentTime) {
    if (!entities.base) return;
    
    for (let altar of entities.altars) {
        if (!altar.lastDamageTime) {
            altar.lastDamageTime = currentTime;
        }
        
        if (currentTime - altar.lastDamageTime >= CONFIG.ALTAR_DAMAGE_INTERVAL) {
            let distance = Math.max(Math.abs(altar.x - entities.base.x), 
                                  Math.abs(altar.y - entities.base.y));
            if (distance <= CONFIG.ALTAR_DAMAGE_RANGE) {
                entities.base.hp -= 10; // 祭坛伤害
                console.log(`祭坛伤害基地，基地血量: ${entities.base.hp}`);
                altar.lastDamageTime = currentTime;
            }
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initGame); 