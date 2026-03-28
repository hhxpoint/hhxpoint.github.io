/**
 * 简化版3D粒子交互系统
 * 基于Three.js
 */

class SimpleParticleSystem {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particles = null;
    this.particleCount = 50000;
    this.rotationSpeed = 0.001;
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
      this.createParticleSystem();
      
      // 3. 初始化控制面板
      this.initControls();
      
      // 4. 初始化事件监听
      this.initEventListeners();
      
      // 5. 开始动画循环
      this.animate();
      
      // 隐藏加载状态
      this.hideLoading();
      
      console.log('3D粒子系统初始化完成');
      console.log('粒子数量:', this.particleCount);
      console.log('场景:', this.scene);
      console.log('相机:', this.camera);
      console.log('渲染器:', this.renderer);
      console.log('粒子对象:', this.particles);
    } catch (error) {
      console.error('初始化失败:', error);
      this.showError('系统初始化失败: ' + error.message);
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
  }
  
  createParticleSystem() {
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
      sizes[i] = Math.random() * 2 + 1;
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
    if(particleCountSlider) {
      particleCountSlider.addEventListener('input', (e) => {
        this.particleCount = parseInt(e.target.value);
        this.updateParticleSystem();
      });
    }
    
    // 粒子大小控制
    const particleSizeSlider = document.getElementById('particle-size');
    if(particleSizeSlider) {
      particleSizeSlider.addEventListener('input', (e) => {
        const size = parseFloat(e.target.value);
        this.updateParticleSizes(size);
      });
    }
    
    // 旋转速度控制
    const rotationSpeedSlider = document.getElementById('rotation-speed');
    if(rotationSpeedSlider) {
      rotationSpeedSlider.addEventListener('input', (e) => {
        this.rotationSpeed = e.target.value / 1000;
      });
    }
    
    // 全屏切换
    const toggleFullscreenButton = document.getElementById('toggle-fullscreen');
    if(toggleFullscreenButton) {
      toggleFullscreenButton.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }
    
    // 重置相机
    const resetCameraButton = document.getElementById('reset-camera');
    if(resetCameraButton) {
      resetCameraButton.addEventListener('click', () => {
        this.resetCamera();
      });
    }
    
    // 隐藏手势按钮（简化版不支持）
    const toggleHandButton = document.getElementById('toggle-hand');
    if(toggleHandButton) {
      toggleHandButton.style.opacity = '0.5';
      toggleHandButton.title = '简化版不支持手势功能';
    }
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
  
  updateParticleSizes(size) {
    if(this.particles && this.particles.geometry.attributes.size) {
      const sizes = this.particles.geometry.attributes.size.array;
      for(let i = 0; i < sizes.length; i++) {
        sizes[i] = Math.random() * size + 1;
      }
      this.particles.geometry.attributes.size.needsUpdate = true;
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
      this.particles.rotation.y += this.rotationSpeed * delta * 10;
      this.particles.rotation.z = this.controls.rotation.z;
      
      // 更新着色器时间
      this.particles.material.uniforms.time.value = time;
    }
    
    // 更新相机位置
    this.camera.position.z = 50 / this.controls.zoom;
    this.camera.position.x = this.controls.pan.x;
    this.camera.position.y = this.controls.pan.y;
    this.camera.lookAt(0, 0, 0);
    
    // 渲染场景
    this.renderer.render(this.scene, this.camera);
  }
  
  // 清理资源
  dispose() {
    if(this.cleanupMouse) this.cleanupMouse();
    if(this.cleanupKeyboard) this.cleanupKeyboard();
    if(this.cleanupTouch) this.cleanupTouch();
    
    if(this.renderer) {
      this.renderer.dispose();
    }
  }
}

// 初始化粒子系统
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM加载完成，开始初始化粒子系统...');
  
  // 检查必要元素是否存在
  const particleContainer = document.getElementById('particle-container');
  if(!particleContainer) {
    console.error('找不到particle-container元素');
    return;
  }
  
  // 检查Three.js是否加载
  if(typeof THREE === 'undefined') {
    console.log('Three.js未加载，开始动态加载...');
    // 动态加载Three.js
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js';
    script.onload = () => {
      console.log('Three.js加载成功');
      try {
        window.particleSystem = new SimpleParticleSystem();
      } catch (error) {
        console.error('粒子系统初始化失败:', error);
        document.getElementById('loading').innerHTML = `
          <p style="color: #ff6b6b;">粒子系统初始化失败: ${error.message}</p>
        `;
      }
    };
    script.onerror = (error) => {
      console.error('Three.js加载失败:', error);
      document.getElementById('loading').innerHTML = `
        <p style="color: #ff6b6b;">无法加载3D引擎，请检查网络连接</p>
        <p style="color: #888; font-size: 12px; margin-top: 10px;">请确保可以访问cdn.jsdelivr.net</p>
      `;
    };
    document.head.appendChild(script);
  } else {
    console.log('Three.js已加载');
    try {
      window.particleSystem = new SimpleParticleSystem();
    } catch (error) {
      console.error('粒子系统初始化失败:', error);
      document.getElementById('loading').innerHTML = `
        <p style="color: #ff6b6b;">粒子系统初始化失败: ${error.message}</p>
      `;
    }
  }
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if(window.particleSystem) {
    window.particleSystem.dispose();
  }
});