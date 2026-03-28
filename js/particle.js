/**
 * 3D粒子交互系统
 * 基于Three.js和MediaPipe手势识别
 */

class ParticleSystem {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particles = null;
    this.particleCount = 50000;
    this.particleSize = 2;
    this.rotationSpeed = 0.2;
    this.bloomIntensity = 0.5;
    this.isFullscreen = false;
    this.isHandTracking = false;
    this.handLandmarks = null;
    this.prevHandPosition = null;
    this.gestureHistory = [];
    this.clock = new THREE.Clock();
    
    // 控制状态
    this.controls = {
      rotation: { x: 0, y: 0, z: 0 },
      zoom: 1,
      pan: { x: 0, y: 0 }
    };
    
    // 初始化
    this.init();
  }
  
  async init() {
    try {
      // 1. 初始化Three.js场景
      this.initThreeJS();
      
      // 2. 创建粒子系统
      await this.createParticleSystem();
      
      // 3. 初始化控制面板
      this.initControls();
      
      // 4. 初始化手势识别（可选）
      this.initHandTracking();
      
      // 5. 初始化事件监听
      this.initEventListeners();
      
      // 6. 开始动画循环
      this.animate();
      
      // 隐藏加载状态
      this.hideLoading();
      
      console.log('3D粒子系统初始化完成');
    } catch (error) {
      console.error('初始化失败:', error);
      this.showError('系统初始化失败，请刷新重试');
    }
  }
  
  initThreeJS() {
    // 场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    
    // 相机
    const container = document.getElementById('particle-container');
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.z = 50;
    
    // 渲染器
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);
    
    // 环境光
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(ambientLight);
    
    // 点光源
    const pointLight1 = new THREE.PointLight(0xFFD700, 1, 100);
    pointLight1.position.set(50, 50, 50);
    this.scene.add(pointLight1);
    
    const pointLight2 = new THREE.PointLight(0xFF8C00, 1, 100);
    pointLight2.position.set(-50, -50, 50);
    this.scene.add(pointLight2);
    
    // 添加泛光效果（简单模拟）
    this.addBloomEffect();
  }
  
  addBloomEffect() {
    // 创建一个简单的泛光效果
    const bloomGeometry = new THREE.PlaneGeometry(2, 2);
    const bloomMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        bloomStrength: { value: this.bloomIntensity },
        time: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float bloomStrength;
        uniform float time;
        varying vec2 vUv;
        
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
          if(brightness > 0.5) {
            color.rgb *= 1.0 + bloomStrength * (brightness - 0.5);
          }
          gl_FragColor = color;
        }
      `,
      transparent: true
    });
    
    this.bloomMesh = new THREE.Mesh(bloomGeometry, bloomMaterial);
    this.bloomMesh.renderOrder = 999;
    this.bloomMesh.frustumCulled = false;
  }
  
  async createParticleSystem() {
    // 创建粒子几何体
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);
    
    // 生成粒子位置 - 创建一个复杂的3D结构
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      
      // 使用球坐标系生成粒子
      const radius = 20 + Math.random() * 30;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);
      
      // 添加一些扰动，创建更有机的结构
      const noise = Math.sin(theta * 5) * Math.cos(phi * 3) * 5;
      positions[i3] += noise * Math.cos(theta);
      positions[i3 + 1] += noise * Math.sin(theta);
      
      // 金色到橙色的渐变颜色
      const color = new THREE.Color();
      color.setHSL(0.1 + Math.random() * 0.1, 0.8, 0.5 + Math.random() * 0.3);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
      
      // 粒子大小
      sizes[i] = Math.random() * this.particleSize + 1;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    // 粒子材质
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        pointTexture: { value: this.createParticleTexture() }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float time;
        
        void main() {
          vColor = color;
          vec3 pos = position;
          
          // 添加粒子动画
          float wave = sin(time + position.x * 0.1) * 2.0;
          pos.y += wave;
          pos.x += cos(time + position.y * 0.1) * 1.5;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D pointTexture;
        varying vec3 vColor;
        
        void main() {
          vec4 texColor = texture2D(pointTexture, gl_PointCoord);
          gl_FragColor = vec4(vColor, 1.0) * texColor;
          
          // 添加发光效果
          float dist = length(gl_PointCoord - vec2(0.5));
          if(dist < 0.3) {
            gl_FragColor.rgb *= 1.5;
          }
        }
      `,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      transparent: true,
      vertexColors: true
    });
    
    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }
  
  createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // 创建径向渐变
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 200, 100, 0.8)');
    gradient.addColorStop(0.7, 'rgba(255, 150, 50, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }
  
  initControls() {
    // 粒子数量控制
    const particleCountSlider = document.getElementById('particle-count');
    particleCountSlider.addEventListener('input', (e) => {
      this.particleCount = parseInt(e.target.value);
      this.updateParticleSystem();
    });
    
    // 粒子大小控制
    const particleSizeSlider = document.getElementById('particle-size');
    particleSizeSlider.addEventListener('input', (e) => {
      this.particleSize = parseFloat(e.target.value);
      this.updateParticleSizes();
    });
    
    // 旋转速度控制
    const rotationSpeedSlider = document.getElementById('rotation-speed');
    rotationSpeedSlider.addEventListener('input', (e) => {
      this.rotationSpeed = e.target.value / 100;
    });
    
    // 泛光强度控制
    const bloomIntensitySlider = document.getElementById('bloom-intensity');
    bloomIntensitySlider.addEventListener('input', (e) => {
      this.bloomIntensity = e.target.value / 100;
      if(this.bloomMesh) {
        this.bloomMesh.material.uniforms.bloomStrength.value = this.bloomIntensity;
      }
    });
    
    // 切换手势控制
    const toggleHandButton = document.getElementById('toggle-hand');
    toggleHandButton.addEventListener('click', () => {
      this.toggleHandTracking();
    });
    
    // 全屏切换
    const toggleFullscreenButton = document.getElementById('toggle-fullscreen');
    toggleFullscreenButton.addEventListener('click', () => {
      this.toggleFullscreen();
    });
    
    // 重置相机
    const resetCameraButton = document.getElementById('reset-camera');
    resetCameraButton.addEventListener('click', () => {
      this.resetCamera();
    });
  }
  
  updateParticleSystem() {
    // 重新创建粒子系统
    if(this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles.material.dispose();
    }
    this.createParticleSystem();
  }
  
  updateParticleSizes() {
    if(this.particles && this.particles.geometry.attributes.size) {
      const sizes = this.particles.geometry.attributes.size.array;
      for(let i = 0; i < sizes.length; i++) {
        sizes[i] = Math.random() * this.particleSize + 1;
      }
      this.particles.geometry.attributes.size.needsUpdate = true;
    }
  }
  
  async initHandTracking() {
    // 动态加载MediaPipe
    try {
      await this.loadMediaPipe();
      console.log('MediaPipe加载完成');
    } catch (error) {
      console.warn('MediaPipe加载失败，手势功能不可用:', error);
    }
  }
  
  async loadMediaPipe() {
    // 加载MediaPipe Hands
    return new Promise((resolve, reject) => {
      // 检查是否已加载
      if(window.Hands) {
        resolve();
        return;
      }
      
      // 创建脚本元素
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        // 加载摄像头工具
        const cameraScript = document.createElement('script');
        cameraScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
        cameraScript.crossOrigin = 'anonymous';
        cameraScript.onload = resolve;
        cameraScript.onerror = reject;
        document.head.appendChild(cameraScript);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  
  toggleHandTracking() {
    if(!this.isHandTracking) {
      this.startHandTracking();
    } else {
      this.stopHandTracking();
    }
  }
  
  async startHandTracking() {
    try {
      // 获取摄像头权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: 640, 
          height: 480,
          facingMode: 'user'
        } 
      });
      
      const video = document.getElementById('video');
      video.srcObject = stream;
      video.play();
      
      // 初始化MediaPipe Hands
      this.hands = new Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });
      
      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
      });
      
      this.hands.onResults((results) => {
        this.processHandResults(results);
      });
      
      // 开始处理视频帧
      this.handCamera = new Camera(video, {
        onFrame: async () => {
          await this.hands.send({ image: video });
        },
        width: 640,
        height: 480
      });
      
      this.handCamera.start();
      this.isHandTracking = true;
      
      // 更新UI
      document.getElementById('toggle-hand').textContent = '关闭手势';
      this.showHandIndicator();
      
    } catch (error) {
      console.error('启动手势识别失败:', error);
      alert('无法访问摄像头，请确保已授予摄像头权限');
    }
  }
  
  stopHandTracking() {
    if(this.handCamera) {
      this.handCamera.stop();
    }
    
    const video = document.getElementById('video');
    if(video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
    
    this.isHandTracking = false;
    document.getElementById('toggle-hand').textContent = '开启手势';
    this.hideHandIndicator();
  }
  
  processHandResults(results) {
    if(results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      this.handLandmarks = results.multiHandLandmarks[0];
      
      // 计算手势
      this.analyzeGestures();
      
      // 更新手势指示器
      this.updateHandIndicator(true);
    } else {
      this.handLandmarks = null;
      this.updateHandIndicator(false);
    }
  }
  
  analyzeGestures() {
    if(!this.handLandmarks) return;
    
    // 获取关键点
    const wrist = this.handLandmarks[0];
    const indexTip = this.handLandmarks[8];
    const middleTip = this.handLandmarks[12];
    const thumbTip = this.handLandmarks[4];
    
    // 计算手掌中心
    const palmCenter = {
      x: (wrist.x + indexTip.x + middleTip.x) / 3,
      y: (wrist.y + indexTip.y + middleTip.y) / 3,
      z: (wrist.z + indexTip.z + middleTip.z) / 3
    };
    
    // 检测手势类型
    const gesture = this.detectGestureType();
    
    // 处理手势
    this.handleGesture(gesture, palmCenter);
    
    // 保存当前位置用于速度计算
    this.prevHandPosition = { ...palmCenter };
  }
  
  detectGestureType() {
    // 检测捏合手势（缩放）
    const thumbIndexDist = this.getDistance(this.handLandmarks[4], this.handLandmarks[8]);
    const isPinching = thumbIndexDist < 0.05;
    
    // 检测拳头手势（旋转）
    const fingerTips = [8, 12, 16, 20]; // 食指、中指、无名指、小指指尖
    let closedFingers = 0;
    fingerTips.forEach(tipIndex => {
      const tip = this.handLandmarks[tipIndex];
      const base = this.handLandmarks[tipIndex - 2];
      if(tip.y > base.y) closedFingers++;
    });
    const isFist = closedFingers >= 3;
    
    // 检测手掌张开（平移）
    const isOpenPalm = !isPinching && !isFist;
    
    if(isPinching) return 'pinch';
    if(isFist) return 'fist';
    if(isOpenPalm) return 'palm';
    
    return 'none';
  }
  
  handleGesture(gesture, palmCenter) {
    const movement = this.prevHandPosition ? {
      x: palmCenter.x - this.prevHandPosition.x,
      y: palmCenter.y - this.prevHandPosition.y,
      z: palmCenter.z - this.prevHandPosition.z
    } : { x: 0, y: 0, z: 0 };
    
    switch(gesture) {
      case 'pinch':
        // 捏合缩放
        this.controls.zoom += movement.z * 2;
        this.controls.zoom = Math.max(0.1, Math.min(5, this.controls.zoom));
        break;
        
      case 'fist':
        // 拳头旋转
        this.controls.rotation.x += movement.y * 2;
        this.controls.rotation.y += movement.x * 2;
        break;
        
      case 'palm':
        // 手掌平移
        this.controls.pan.x += movement.x * 50;
        this.controls.pan.y -= movement.y * 50;
        break;
    }
  }
  
  getDistance(point1, point2) {
    return Math.sqrt(
      Math.pow(point1.x - point2.x, 2) +
      Math.pow(point1.y - point2.y, 2) +
      Math.pow(point1.z - point2.z, 2)
    );
  }
  
  showHandIndicator() {
    let indicator = document.querySelector('.hand-indicator');
    if(!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'hand-indicator active';
      indicator.innerHTML = `
        <div class="status">
          <div class="status-dot"></div>
          <span>手势识别已开启</span>
        </div>
      `;
      document.body.appendChild(indicator);
    } else {
      indicator.classList.add('active');
    }
  }
  
  hideHandIndicator() {
    const indicator = document.querySelector('.hand-indicator');
    if(indicator) {
      indicator.classList.remove('active');
    }
  }
  
  updateHandIndicator(isTracking) {
    const indicator = document.querySelector('.hand-indicator');
    if(indicator) {
      const statusText = indicator.querySelector('span');
      if(isTracking) {
        statusText.textContent = '检测到手势';
      } else {
        statusText.textContent = '等待手势...';
      }
    }
  }
  
  initEventListeners() {
    // 窗口大小变化
    window.addEventListener('resize', () => {
      this.onWindowResize();
    });
    
    // 鼠标控制
    this.initMouseControls();
    
    // 键盘控制
    this.initKeyboardControls();
    
    // 触摸控制
    this.initTouchControls();
  }
  
  initMouseControls() {
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    const onMouseDown = (e) => {
      if(e.button === 0) { // 左键
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };
    
    const onMouseMove = (e) => {
      if(!isDragging) return;
      
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;
      
      this.controls.rotation.y += deltaX * 0.01;
      this.controls.rotation.x += deltaY * 0.01;
      
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };
    
    const onMouseUp = () => {
      isDragging = false;
    };
    
    const onWheel = (e) => {
      e.preventDefault();
      this.controls.zoom += e.deltaY * 0.001;
      this.controls.zoom = Math.max(0.1, Math.min(5, this.controls.zoom));
    };
    
    this.renderer.domElement.addEventListener('mousedown', onMouseDown);
    this.renderer.domElement.addEventListener('mousemove', onMouseMove);
    this.renderer.domElement.addEventListener('mouseup', onMouseUp);
    this.renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    
    // 保存清理函数
    this.cleanupMouse = () => {
      this.renderer.domElement.removeEventListener('mousedown', onMouseDown);
      this.renderer.domElement.removeEventListener('mousemove', onMouseMove);
      this.renderer.domElement.removeEventListener('mouseup', onMouseUp);
      this.renderer.domElement.removeEventListener('wheel', onWheel);
    };
  }
  
  initKeyboardControls() {
    const onKeyDown = (e) => {
      switch(e.key) {
        case ' ':
          this.resetCamera();
          break;
        case 'f':
          this.toggleFullscreen();
          break;
        case 'h':
          this.toggleHandTracking();
          break;
        case 'ArrowUp':
          this.controls.pan.y -= 5;
          break;
        case 'ArrowDown':
          this.controls.pan.y += 5;
          break;
        case 'ArrowLeft':
          this.controls.pan.x -= 5;
          break;
        case 'ArrowRight':
          this.controls.pan.x += 5;
          break;
      }
    };
    
    document.addEventListener('keydown', onKeyDown);
    this.cleanupKeyboard = () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }
  
  initTouchControls() {
    let touchStartDistance = 0;
    let touchStartZoom = 1;
    
    const onTouchStart = (e) => {
      if(e.touches.length === 2) {
        touchStartDistance = this.getTouchDistance(e.touches);
        touchStartZoom = this.controls.zoom;
      }
    };
    
    const onTouchMove = (e) => {
      if(e.touches.length === 2) {
        const distance = this.getTouchDistance(e.touches);
        const scale = distance / touchStartDistance;
        this.controls.zoom = touchStartZoom * scale;
        this.controls.zoom = Math.max(0.1, Math.min(5, this.controls.zoom));
        e.preventDefault();
      }
    };
    
    this.renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    this.renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    
    this.cleanupTouch = () => {
      this.renderer.domElement.removeEventListener('touchstart', onTouchStart);
      this.renderer.domElement.removeEventListener('touchmove', onTouchMove);
    };
  }
  
  getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  toggleFullscreen() {
    if(!this.isFullscreen) {
      this.enterFullscreen();
    } else {
      this.exitFullscreen();
    }
  }
  
  enterFullscreen() {
    const element = document.documentElement;
    
    if(element.requestFullscreen) {
      element.requestFullscreen();
    } else if(element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    } else if(element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else if(element.msRequestFullscreen) {
      element.msRequestFullscreen();
    }
    
    this.isFullscreen = true;
    document.getElementById('toggle-fullscreen').textContent = '退出全屏';
  }
  
  exitFullscreen() {
    if(document.exitFullscreen) {
      document.exitFullscreen();
    } else if(document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if(document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if(document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    
    this.isFullscreen = false;
    document.getElementById('toggle-fullscreen').textContent = '全屏';
  }
  
  resetCamera() {
    this.controls = {
      rotation: { x: 0, y: 0, z: 0 },
      zoom: 1,
      pan: { x: 0, y: 0 }
    };
    this.camera.position.set(0, 0, 50);
    this.camera.lookAt(0, 0, 0);
  }
  
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  hideLoading() {
    const loading = document.getElementById('loading');
    if(loading) {
      loading.style.opacity = '0';
      setTimeout(() => {
        loading.style.display = 'none';
      }, 500);
    }
  }
  
  showError(message) {
    const loading = document.getElementById('loading');
    if(loading) {
      loading.innerHTML = `
        <div style="color: #ff6b6b; font-size: 18px; margin-bottom: 20px;">⚠️</div>
        <p style="color: #ff6b6b;">${message}</p>
        <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: rgba(255,100,100,0.2); border: 1px solid rgba(255,100,100,0.5); color: white; border-radius: 5px; cursor: pointer;">
          重新加载
        </button>
      `;
    }
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();
    
    // 更新粒子动画
    if(this.particles) {
      this.particles.rotation.x = this.controls.rotation.x;
      this.particles.rotation.y += this.rotationSpeed * delta;
      this.particles.rotation.z = this.controls.rotation.z;
      
      // 更新着色器时间
      this.particles.material.uniforms.time.value = time;
    }
    
    // 更新相机位置
    this.camera.position.z = 50 / this.controls.zoom;
    this.camera.position.x = this.controls.pan.x;
    this.camera.position.y = this.controls.pan.y;
    this.camera.lookAt(0, 0, 0);
    
    // 更新泛光效果
    if(this.bloomMesh) {
      this.bloomMesh.material.uniforms.time.value = time;
    }
    
    // 渲染场景
    this.renderer.render(this.scene, this.camera);
  }
  
  // 清理资源
  dispose() {
    if(this.cleanupMouse) this.cleanupMouse();
    if(this.cleanupKeyboard) this.cleanupKeyboard();
    if(this.cleanupTouch) this.cleanupTouch();
    
    if(this.isHandTracking) {
      this.stopHandTracking();
    }
    
    if(this.renderer) {
      this.renderer.dispose();
    }
  }
}

// 初始化粒子系统
document.addEventListener('DOMContentLoaded', () => {
  // 检查Three.js是否加载
  if(typeof THREE === 'undefined') {
    // 动态加载Three.js
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js';
    script.onload = () => {
      window.particleSystem = new ParticleSystem();
    };
    script.onerror = () => {
      console.error('Three.js加载失败');
      document.getElementById('loading').innerHTML = `
        <p style="color: #ff6b6b;">无法加载3D引擎，请检查网络连接</p>
      `;
    };
    document.head.appendChild(script);
  } else {
    window.particleSystem = new ParticleSystem();
  }
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if(window.particleSystem) {
    window.particleSystem.dispose();
  }
});