/**
 * Three.js 3D Chemistry Lab Renderer
 * Converts 2D apparatus to interactive 3D models
 */

// ============= CONFIGURATION =============
const CONFIG = {
    // Camera settings
    camera: {
        fov: 40,
        near: 0.1,
        far: 1000,
        position: { x: 0, y: 2.5, z: 10 }
    },
    // Ultra-realistic HDR lighting setup
    light: {
        ambient: { color: 0xffffff, intensity: 0.6 },
        directional: { color: 0xfff5eb, intensity: 1.2, position: { x: 5, y: 12, z: 8 } },
        fill: { color: 0x8ecae6, intensity: 0.5, position: { x: -6, y: 6, z: -6 } },
        rim: { color: 0xffffff, intensity: 0.8, position: { x: 0, y: 0, z: -12 } },
        top: { color: 0xfff8f0, intensity: 0.4, position: { x: 0, y: 15, z: 0 } }
    },
    // Orbit controls constraints
    controls: {
        minPolarAngle: Math.PI / 4,
        maxPolarAngle: Math.PI / 1.8,
        minAzimuthAngle: -Math.PI / 3,
        maxAzimuthAngle: Math.PI / 3,
        enablePan: false,
        enableZoom: true,
        minDistance: 4,
        maxDistance: 18
    },
    // Ultra-realistic PBR material settings
    materials: {
        glass: {
            color: 0xe0f0ff,  // Slight blue tint for visibility
            transparent: true,
            opacity: 0.45,    // Much higher opacity for visibility
            roughness: 0.05,
            metalness: 0.1,
            envMapIntensity: 2.5,
            clearcoat: 1.0,
            clearcoatRoughness: 0.02,
            transmission: 0.6,  // Lower transmission for more visibility
            thickness: 2.0,
            ior: 1.52  // Glass refractive index
        },
        liquid: {
            transparent: true,
            opacity: 0.92,
            roughness: 0.05,
            metalness: 0.02,
            envMapIntensity: 1.2,
            transmission: 0.4
        },
        metal: {
            color: 0x9ca3af,
            roughness: 0.15,
            metalness: 0.98,
            envMapIntensity: 1.5
        },
        chrome: {
            color: 0xe5e7eb,
            roughness: 0.08,
            metalness: 1.0,
            envMapIntensity: 2.0
        },
        rubber: {
            color: 0x1f2937,
            roughness: 0.9,
            metalness: 0.0
        }
    },
    // Vibrant liquid colors with enhanced saturation
    colors: {
        water: 0x7dd3fc,
        buffer: 0xfcd34d,
        wineRed: 0xbe123c,
        purple: 0xa855f7,
        blue: 0x3b82f6,
        edta: 0x60a5fa
    }
};

// ============= MAIN LAB 3D RENDERER CLASS =============
class Lab3DRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Lab3DRenderer: Container not found:', containerId);
            return;
        }

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;

        // 3D apparatus references
        this.burette = null;
        this.buretteStand = null;
        this.flask = null;
        this.bottles = [];
        this.drops = [];

        // State
        this.isInitialized = false;
        this.animationId = null;

        // Particle system
        this.bubbles = [];
        this.dustParticles = null;

        this.init();
    }

    init() {
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupLights();
        this.setupControls();
        this.createApparatus();
        this.initParticles();  // Initialize particle system
        this.animate();
        this.handleResize();

        this.isInitialized = true;
        console.log('Lab3DRenderer initialized with enhanced animations');
    }

    setupScene() {
        this.scene = new THREE.Scene();
        // Transparent background to blend with existing UI
        this.scene.background = null;
    }

    setupCamera() {
        const { fov, near, far, position } = CONFIG.camera;
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.camera.position.set(position.x, position.y, position.z);
        this.camera.lookAt(0, 0, 0);
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        // r128 compatible settings
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        this.container.appendChild(this.renderer.domElement);
        this.renderer.domElement.id = 'labCanvas3D';
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
    }

    setupLights() {
        const { ambient, directional, fill, rim, top } = CONFIG.light;

        // Ambient light for overall illumination
        const ambientLight = new THREE.AmbientLight(ambient.color, ambient.intensity);
        this.scene.add(ambientLight);

        // Main directional light with high-quality shadows
        const dirLight = new THREE.DirectionalLight(directional.color, directional.intensity);
        dirLight.position.set(directional.position.x, directional.position.y, directional.position.z);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 60;
        dirLight.shadow.camera.left = -10;
        dirLight.shadow.camera.right = 10;
        dirLight.shadow.camera.top = 10;
        dirLight.shadow.camera.bottom = -10;
        dirLight.shadow.bias = -0.0001;
        dirLight.shadow.radius = 2;
        this.scene.add(dirLight);

        // Fill light from opposite side (cool tone)
        const fillLight = new THREE.DirectionalLight(fill.color, fill.intensity);
        fillLight.position.set(fill.position.x, fill.position.y, fill.position.z);
        this.scene.add(fillLight);

        // Rim light for glass edge highlights
        const rimLight = new THREE.DirectionalLight(rim.color, rim.intensity);
        rimLight.position.set(rim.position.x, rim.position.y, rim.position.z);
        this.scene.add(rimLight);

        // Top light for studio-quality illumination
        const topLight = new THREE.DirectionalLight(top.color, top.intensity);
        topLight.position.set(top.position.x, top.position.y, top.position.z);
        this.scene.add(topLight);

        // Key light for specular highlights on glass
        const specularLight = new THREE.PointLight(0xffffff, 0.5, 25);
        specularLight.position.set(4, 5, 6);
        this.scene.add(specularLight);

        // Back fill point light
        const backFill = new THREE.PointLight(0x93c5fd, 0.3, 20);
        backFill.position.set(-3, 3, -4);
        this.scene.add(backFill);

        // Hemisphere light for natural sky-ground gradient
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x374151, 0.4);
        hemiLight.position.set(0, 12, 0);
        this.scene.add(hemiLight);
    }

    setupControls() {
        if (typeof THREE.OrbitControls === 'undefined') {
            console.warn('OrbitControls not loaded');
            return;
        }

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enablePan = CONFIG.controls.enablePan;
        this.controls.enableZoom = CONFIG.controls.enableZoom;
        this.controls.minPolarAngle = CONFIG.controls.minPolarAngle;
        this.controls.maxPolarAngle = CONFIG.controls.maxPolarAngle;
        this.controls.minAzimuthAngle = CONFIG.controls.minAzimuthAngle;
        this.controls.maxAzimuthAngle = CONFIG.controls.maxAzimuthAngle;
        this.controls.minDistance = CONFIG.controls.minDistance;
        this.controls.maxDistance = CONFIG.controls.maxDistance;
        this.controls.target.set(0, 0, 0);
    }

    handleResize() {
        window.addEventListener('resize', () => {
            if (!this.container || !this.camera || !this.renderer) return;

            const width = this.container.clientWidth;
            const height = this.container.clientHeight;

            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        });
    }

    // ============= CREATE 3D APPARATUS =============
    createApparatus() {
        this.createBench();
        this.createBuretteStand();
        this.createBurette();
        this.createFlask();
        this.createReagentBottles();
    }

    // Lab bench surface
    createBench() {
        const benchGeo = new THREE.BoxGeometry(12, 0.3, 5);
        const benchMat = new THREE.MeshStandardMaterial({
            color: 0x57534e,
            roughness: 0.8,
            metalness: 0.1
        });
        const bench = new THREE.Mesh(benchGeo, benchMat);
        bench.position.set(0, -2.5, 0);
        this.scene.add(bench);
    }

    // Ultra-High Quality Burette Stand
    createBuretteStand() {
        const group = new THREE.Group();

        // Chrome material for premium look
        const chromeMat = new THREE.MeshStandardMaterial({
            ...CONFIG.materials.chrome,
            color: 0xd1d5db,
            roughness: 0.1,
            metalness: 1.0
        });

        // Matte black base material
        const baseMat = new THREE.MeshStandardMaterial({
            color: 0x1f2937,
            roughness: 0.6,
            metalness: 0.4
        });

        // Heavy base with beveled edges - 128 segments for ultra smoothness
        const baseShape = new THREE.Shape();
        const bw = 0.9, bh = 0.6;
        const radius = 0.08;
        baseShape.moveTo(-bw + radius, -bh);
        baseShape.lineTo(bw - radius, -bh);
        baseShape.quadraticCurveTo(bw, -bh, bw, -bh + radius);
        baseShape.lineTo(bw, bh - radius);
        baseShape.quadraticCurveTo(bw, bh, bw - radius, bh);
        baseShape.lineTo(-bw + radius, bh);
        baseShape.quadraticCurveTo(-bw, bh, -bw, bh - radius);
        baseShape.lineTo(-bw, -bh + radius);
        baseShape.quadraticCurveTo(-bw, -bh, -bw + radius, -bh);

        const baseGeo = new THREE.ExtrudeGeometry(baseShape, {
            depth: 0.12,
            bevelEnabled: true,
            bevelThickness: 0.02,
            bevelSize: 0.02,
            bevelSegments: 8,
            curveSegments: 32
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.rotation.x = -Math.PI / 2;
        base.position.y = -2.35;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        // Vertical rod - high poly cylinder with chrome finish
        const rodGeo = new THREE.CylinderGeometry(0.055, 0.055, 5.2, 64, 1);
        const rod = new THREE.Mesh(rodGeo, chromeMat);
        rod.position.y = 0.25;
        rod.castShadow = true;
        rod.receiveShadow = true;
        group.add(rod);

        // Rod cap at top
        const capGeo = new THREE.SphereGeometry(0.07, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const cap = new THREE.Mesh(capGeo, chromeMat);
        cap.position.y = 2.85;
        group.add(cap);

        // Burette clamp assembly
        const clampGroup = new THREE.Group();

        // Clamp arm
        const armGeo = new THREE.BoxGeometry(0.7, 0.1, 0.15);
        const arm = new THREE.Mesh(armGeo, chromeMat);
        arm.castShadow = true;
        clampGroup.add(arm);

        // Clamp ring that holds burette - torus
        const ringGeo = new THREE.TorusGeometry(0.22, 0.035, 24, 64);
        const ring = new THREE.Mesh(ringGeo, chromeMat);
        ring.rotation.y = Math.PI / 2;
        ring.position.x = 0.4;
        ring.castShadow = true;
        clampGroup.add(ring);

        // Screw detail on clamp
        const screwGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.15, 32);
        const screw = new THREE.Mesh(screwGeo, baseMat);
        screw.rotation.z = Math.PI / 2;
        screw.position.set(-0.2, 0, 0.12);
        screw.castShadow = true;
        clampGroup.add(screw);

        // Screw head
        const screwHead = new THREE.CylinderGeometry(0.06, 0.06, 0.03, 6);
        const head = new THREE.Mesh(screwHead, baseMat);
        head.rotation.z = Math.PI / 2;
        head.position.set(-0.2, 0, 0.2);
        clampGroup.add(head);

        clampGroup.position.set(0.05, 1.85, 0);
        group.add(clampGroup);

        group.position.set(2, 0, 0);
        this.buretteStand = group;
        this.scene.add(group);
    }

    // Burette with liquid - High Quality Model
    createBurette() {
        const group = new THREE.Group();

        // Enhanced glass material for realistic burette - MORE VISIBLE
        const glassMat = new THREE.MeshPhysicalMaterial({
            color: 0xc8e0ff,  // Light blue tint for visibility
            transparent: true,
            opacity: 0.55,    // Higher opacity for better visibility
            roughness: 0.03,
            metalness: 0.15,
            transmission: 0.5, // Reduced transmission for visibility
            thickness: 1.5,
            clearcoat: 1.0,
            clearcoatRoughness: 0.02,
            side: THREE.DoubleSide,
            envMapIntensity: 2.0,
            emissive: 0x3b82f6,  // Subtle blue glow
            emissiveIntensity: 0.05
        });

        // Glass tube (main body) - higher polygon count
        const tubeOuterGeo = new THREE.CylinderGeometry(0.18, 0.18, 4, 64, 1, true);
        const tubeOuter = new THREE.Mesh(tubeOuterGeo, glassMat);
        tubeOuter.castShadow = true;
        tubeOuter.receiveShadow = true;
        group.add(tubeOuter);

        // Inner tube for glass thickness effect
        const tubeInnerGeo = new THREE.CylinderGeometry(0.16, 0.16, 4, 64, 1, true);
        const tubeInner = new THREE.Mesh(tubeInnerGeo, glassMat);
        group.add(tubeInner);

        // Top rim of burette
        const topRimGeo = new THREE.TorusGeometry(0.18, 0.02, 16, 32);
        const topRim = new THREE.Mesh(topRimGeo, glassMat);
        topRim.rotation.x = Math.PI / 2;
        topRim.position.y = 2;
        group.add(topRim);

        // Liquid inside burette with better material
        const liquidGeo = new THREE.CylinderGeometry(0.14, 0.14, 3.9, 48);
        this.buretteLiquidMat = new THREE.MeshPhysicalMaterial({
            color: CONFIG.colors.edta,
            transparent: true,
            opacity: 0.92,
            roughness: 0.05,
            metalness: 0.0,
            transmission: 0.3,
            emissive: CONFIG.colors.edta,
            emissiveIntensity: 0.15
        });
        this.buretteLiquid = new THREE.Mesh(liquidGeo, this.buretteLiquidMat);
        this.buretteLiquid.scale.y = 0;
        this.buretteLiquid.position.y = -1.95;
        group.add(this.buretteLiquid);

        // Meniscus on top of liquid
        const meniscusGeo = new THREE.SphereGeometry(0.14, 32, 16, 0, Math.PI * 2, 0, Math.PI / 4);
        this.buretteMeniscus = new THREE.Mesh(meniscusGeo, this.buretteLiquidMat);
        this.buretteMeniscus.rotation.x = Math.PI;
        this.buretteMeniscus.visible = false;
        group.add(this.buretteMeniscus);

        // Stopcock assembly with more detail
        const stopcockBodyGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 24);
        stopcockBodyGeo.rotateZ(Math.PI / 2);
        const stopcockMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            roughness: 0.3,
            metalness: 0.7
        });
        const stopcockBody = new THREE.Mesh(stopcockBodyGeo, stopcockMat);
        stopcockBody.position.y = -2.1;
        stopcockBody.castShadow = true;
        group.add(stopcockBody);

        // Stopcock handle - T-shaped
        const handleMat = new THREE.MeshStandardMaterial({
            color: 0x2563eb,
            roughness: 0.25,
            metalness: 0.3,
            emissive: 0x1e40af,
            emissiveIntensity: 0.1
        });
        const handleGeo = new THREE.BoxGeometry(0.06, 0.3, 0.06, 4, 4, 4);
        this.stopcockHandle = new THREE.Mesh(handleGeo, handleMat);
        this.stopcockHandle.position.y = -2.1;
        this.stopcockHandle.castShadow = true;
        group.add(this.stopcockHandle);

        // Tip (narrow end) with taper
        const tipGeo = new THREE.CylinderGeometry(0.025, 0.04, 0.35, 24);
        const tip = new THREE.Mesh(tipGeo, glassMat);
        tip.position.y = -2.38;
        group.add(tip);

        // Drip tip at very end
        const dripTipGeo = new THREE.CylinderGeometry(0.015, 0.025, 0.1, 16);
        const dripTip = new THREE.Mesh(dripTipGeo, glassMat);
        dripTip.position.y = -2.58;
        group.add(dripTip);

        // Scale markings
        this.createBuretteScale(group);

        group.position.set(2.4, 1.9, 0);
        this.burette = group;
        this.scene.add(group);
    }

    createBuretteScale(group) {
        const scaleGroup = new THREE.Group();
        const lineMat = new THREE.LineBasicMaterial({ color: 0x000000 });

        for (let i = 0; i <= 10; i++) {
            const y = 1.9 - (i * 0.38);
            const width = i % 5 === 0 ? 0.3 : 0.15;

            const points = [
                new THREE.Vector3(0.18, y, 0),
                new THREE.Vector3(0.18 + width, y, 0)
            ];
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(lineGeo, lineMat);
            scaleGroup.add(line);
        }

        group.add(scaleGroup);
    }

    // Conical Flask with liquid - High Quality Model
    createFlask() {
        const group = new THREE.Group();

        // Enhanced glass material for realistic flask
        const glassMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.18,
            roughness: 0.02,
            metalness: 0.0,
            transmission: 0.92,
            thickness: 0.8,
            clearcoat: 1.0,
            clearcoatRoughness: 0.03,
            side: THREE.DoubleSide,
            envMapIntensity: 1.2
        });

        // Flask body using LatheGeometry with more points for smoother curves
        const flaskPoints = [];
        // Neck with rim
        flaskPoints.push(new THREE.Vector2(0.22, 1.25));
        flaskPoints.push(new THREE.Vector2(0.2, 1.2));
        flaskPoints.push(new THREE.Vector2(0.2, 0.85));
        // Shoulder with smooth curve
        flaskPoints.push(new THREE.Vector2(0.22, 0.75));
        flaskPoints.push(new THREE.Vector2(0.3, 0.6));
        flaskPoints.push(new THREE.Vector2(0.45, 0.45));
        flaskPoints.push(new THREE.Vector2(0.6, 0.3));
        flaskPoints.push(new THREE.Vector2(0.72, 0.15));
        // Body
        flaskPoints.push(new THREE.Vector2(0.8, 0.05));
        flaskPoints.push(new THREE.Vector2(0.82, 0));
        flaskPoints.push(new THREE.Vector2(0.82, -0.08));
        // Base
        flaskPoints.push(new THREE.Vector2(0.78, -0.12));
        flaskPoints.push(new THREE.Vector2(0, -0.12));

        const flaskGeo = new THREE.LatheGeometry(flaskPoints, 64);
        const flaskMesh = new THREE.Mesh(flaskGeo, glassMat);
        flaskMesh.castShadow = true;
        flaskMesh.receiveShadow = true;
        group.add(flaskMesh);

        // Neck rim for realism
        const rimGeo = new THREE.TorusGeometry(0.21, 0.02, 12, 32);
        const rimMesh = new THREE.Mesh(rimGeo, glassMat);
        rimMesh.rotation.x = Math.PI / 2;
        rimMesh.position.y = 1.25;
        group.add(rimMesh);

        // Volume markings on flask (simple lines)
        this.createFlaskMarkings(group);

        // Liquid inside flask with enhanced material
        const maxLiquidHeight = 0.5;
        const liquidGeo = new THREE.CylinderGeometry(0.55, 0.7, maxLiquidHeight, 48);
        this.flaskLiquidMat = new THREE.MeshPhysicalMaterial({
            color: CONFIG.colors.water,
            transparent: true,
            opacity: 0.88,
            roughness: 0.08,
            metalness: 0.0,
            transmission: 0.2,
            emissive: CONFIG.colors.water,
            emissiveIntensity: 0.12
        });
        this.flaskLiquid = new THREE.Mesh(liquidGeo, this.flaskLiquidMat);
        this.flaskLiquid.position.y = -0.1;
        this.flaskLiquid.scale.y = 0;
        this.flaskLiquid.visible = false;
        group.add(this.flaskLiquid);

        // Liquid surface with meniscus curve
        const surfacePoints = [];
        for (let i = 0; i <= 32; i++) {
            const t = i / 32;
            const x = t * 0.6;
            const y = -0.02 * Math.sin(t * Math.PI); // Concave meniscus
            surfacePoints.push(new THREE.Vector2(x, y));
        }
        const surfaceGeo = new THREE.LatheGeometry(surfacePoints, 32);
        this.liquidSurface = new THREE.Mesh(surfaceGeo, this.flaskLiquidMat);
        this.liquidSurface.position.y = 0;
        this.liquidSurface.visible = false;
        group.add(this.liquidSurface);

        group.position.set(2.4, -2.1, 0.5);
        group.scale.set(1.0, 1.0, 1.0);
        this.flask = group;
        this.scene.add(group);
    }

    // Volume markings on flask
    createFlaskMarkings(group) {
        const markMat = new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 1 });
        const markings = [
            { y: 0.0, label: '50' },
            { y: 0.15, label: '100' },
            { y: 0.28, label: '150' }
        ];

        markings.forEach(mark => {
            const points = [];
            for (let i = 0; i <= 8; i++) {
                const angle = (i / 8) * Math.PI * 0.3 - Math.PI * 0.15;
                const r = 0.75 - mark.y * 0.2;
                points.push(new THREE.Vector3(
                    Math.sin(angle) * r,
                    mark.y,
                    Math.cos(angle) * r
                ));
            }
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(lineGeo, markMat);
            group.add(line);
        });
    }

    // Reagent Bottles
    createReagentBottles() {
        const bottleData = [
            { name: 'sample', color: CONFIG.colors.water, label: 'Water Sample', x: -3.5 },
            { name: 'buffer', color: CONFIG.colors.buffer, label: 'Buffer pH 10', x: -2.3 },
            { name: 'indicator', color: 0xef4444, label: 'EBT Indicator', x: -1.1 },
            { name: 'edta', color: CONFIG.colors.edta, label: 'EDTA 0.01M', x: 0.1 }
        ];

        bottleData.forEach((data, index) => {
            const bottle = this.createBottle(data.color, data.name, data.label);
            bottle.position.set(data.x, -1.8, 1.5);
            bottle.userData = { name: data.name, index };
            this.bottles.push(bottle);
            this.scene.add(bottle);
        });
    }

    createBottle(liquidColor, name, labelText) {
        const group = new THREE.Group();

        // Ultra-realistic bottle shape using LatheGeometry
        const bottlePoints = [];
        bottlePoints.push(new THREE.Vector2(0.28, -0.4));   // Base
        bottlePoints.push(new THREE.Vector2(0.28, -0.38));  // Base edge
        bottlePoints.push(new THREE.Vector2(0.26, 0.15));   // Body taper
        bottlePoints.push(new THREE.Vector2(0.22, 0.25));   // Shoulder start
        bottlePoints.push(new THREE.Vector2(0.14, 0.35));   // Neck transition
        bottlePoints.push(new THREE.Vector2(0.12, 0.45));   // Neck
        bottlePoints.push(new THREE.Vector2(0.13, 0.48));   // Lip
        bottlePoints.push(new THREE.Vector2(0.13, 0.5));    // Top

        const bodyGeo = new THREE.LatheGeometry(bottlePoints, 48);
        const glassMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.25,
            roughness: 0.05,
            metalness: 0.0,
            transmission: 0.85,
            thickness: 0.8,
            clearcoat: 0.8,
            clearcoatRoughness: 0.1,
            side: THREE.DoubleSide,
            envMapIntensity: 1.2
        });
        const body = new THREE.Mesh(bodyGeo, glassMat);
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // Liquid inside with highly visible opaque colored material
        const liquidPoints = [];
        liquidPoints.push(new THREE.Vector2(0.22, -0.35));
        liquidPoints.push(new THREE.Vector2(0.22, 0.08));
        liquidPoints.push(new THREE.Vector2(0.16, 0.14));
        liquidPoints.push(new THREE.Vector2(0.0, 0.16));

        const liquidGeo = new THREE.LatheGeometry(liquidPoints, 32);
        const liquidMat = new THREE.MeshStandardMaterial({
            color: liquidColor,
            transparent: false,
            roughness: 0.15,
            metalness: 0.1,
            emissive: liquidColor,
            emissiveIntensity: 0.35
        });
        const liquid = new THREE.Mesh(liquidGeo, liquidMat);
        liquid.position.y = 0.02;
        group.add(liquid);

        // Screw cap with thread detail
        const capMat = new THREE.MeshStandardMaterial({
            color: 0x1e3a5f,
            roughness: 0.35,
            metalness: 0.6
        });

        // Cap body
        const capBodyGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.12, 32);
        const capBody = new THREE.Mesh(capBodyGeo, capMat);
        capBody.position.y = 0.56;
        capBody.castShadow = true;
        group.add(capBody);

        // Cap top (slightly domed)
        const capTopGeo = new THREE.SphereGeometry(0.14, 24, 12, 0, Math.PI * 2, 0, Math.PI / 8);
        const capTop = new THREE.Mesh(capTopGeo, capMat);
        capTop.position.y = 0.62;
        group.add(capTop);

        // Rubber dropper bulb
        const bulbMat = new THREE.MeshStandardMaterial({
            color: 0x374151,
            roughness: 0.85,
            metalness: 0.0
        });
        const bulbGeo = new THREE.SphereGeometry(0.09, 24, 16);
        bulbGeo.scale(1, 1.3, 1);
        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.y = 0.72;
        bulb.castShadow = true;
        group.add(bulb);

        // Glass dropper tip
        const dropperGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.22, 24);
        const dropperMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.3,
            roughness: 0.05,
            transmission: 0.9,
            thickness: 0.2
        });
        const dropper = new THREE.Mesh(dropperGeo, dropperMat);
        dropper.position.y = 0.86;
        group.add(dropper);

        // Label using Sprite with canvas texture
        if (labelText) {
            const label = this.createTextLabel(labelText);
            label.position.set(0, 0, 0.45);
            group.add(label);
        }

        return group;
    }

    // Create text label using canvas texture
    createTextLabel(text) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;

        // Background
        context.fillStyle = 'rgba(255, 255, 255, 0.9)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Border
        context.strokeStyle = '#4a5568';
        context.lineWidth = 3;
        context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

        // Text
        context.fillStyle = '#1a202c';
        context.font = 'bold 24px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(1.0, 0.25, 1);

        return sprite;
    }

    // Update bottle labels when parameters change
    updateBottleLabels(params) {
        if (!this.bottles || this.bottles.length === 0) return;

        this.bottles.forEach(bottle => {
            const name = bottle.userData.name;

            // Find the label sprite (it's a Sprite child of the bottle group)
            let labelSprite = null;
            bottle.traverse(child => {
                if (child instanceof THREE.Sprite) {
                    labelSprite = child;
                }
            });

            if (labelSprite) {
                let newText = null;

                if (name === 'edta' && params.edta) {
                    newText = 'EDTA ' + params.edta;
                } else if (name === 'buffer' && params.buffer) {
                    newText = 'Buffer ' + params.buffer;
                }

                if (newText) {
                    // Create new label texture
                    const newLabel = this.createTextLabel(newText);
                    labelSprite.material.map = newLabel.material.map;
                    labelSprite.material.needsUpdate = true;
                }
            }
        });
    }

    // ============= ANIMATION LOOP =============
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        const time = Date.now() * 0.001;

        if (this.controls) {
            this.controls.update();
        }

        // Animate drops
        this.updateDrops();

        // Enhanced idle animations
        this.animateIdleEffects(time);

        // Animate particles
        this.updateParticles(time);

        this.renderer.render(this.scene, this.camera);
    }

    // Enhanced idle animations for all apparatus
    animateIdleEffects(time) {
        // Flask gentle swaying
        if (this.flask) {
            this.flask.rotation.z = Math.sin(time * 0.8) * 0.015;
            this.flask.position.y = -2.1 + Math.sin(time * 1.2) * 0.01;
        }

        // Flask liquid wave effect
        if (this.flaskLiquid && this.flaskLiquid.visible) {
            this.flaskLiquid.rotation.z = Math.sin(time * 2) * 0.02;
            // Subtle scale pulse for "breathing" effect
            const breathe = 1 + Math.sin(time * 1.5) * 0.02;
            this.flaskLiquid.scale.x = this.flaskLiquid.scale.z = breathe * (this.flaskLiquid.scale.y > 0 ? 1 : 0);
        }

        // Liquid surface ripple
        if (this.liquidSurface && this.liquidSurface.visible) {
            this.liquidSurface.rotation.z = time * 0.3;
        }

        // Bottles gentle bob animation
        this.bottles.forEach((bottle, i) => {
            const phase = i * 0.5;
            bottle.position.y = -1.8 + Math.sin(time * 0.6 + phase) * 0.015;
            bottle.rotation.z = Math.sin(time * 0.4 + phase) * 0.01;
        });

        // Burette liquid shimmer
        if (this.buretteLiquid && this.buretteLiquid.scale.y > 0) {
            const shimmer = 1 + Math.sin(time * 3) * 0.005;
            this.buretteLiquid.scale.x = this.buretteLiquid.scale.z = shimmer;
        }

        // Stopcock handle subtle movement
        if (this.stopcockHandle) {
            this.stopcockHandle.rotation.z = Math.sin(time * 0.3) * 0.02;
        }
    }

    // ============= PARTICLE SYSTEM =============
    initParticles() {
        this.bubbles = [];
        this.dustMotes = [];
        this.createDustMotes();
    }

    // Create ambient floating dust particles
    createDustMotes() {
        const dustGeometry = new THREE.BufferGeometry();
        const dustCount = 50;
        const positions = new Float32Array(dustCount * 3);

        for (let i = 0; i < dustCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 10;     // x
            positions[i + 1] = (Math.random() - 0.5) * 5;  // y
            positions[i + 2] = (Math.random() - 0.5) * 6;  // z
        }

        dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const dustMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.03,
            transparent: true,
            opacity: 0.4,
            sizeAttenuation: true
        });

        this.dustParticles = new THREE.Points(dustGeometry, dustMaterial);
        this.scene.add(this.dustParticles);
    }

    // Create bubble in flask liquid
    createBubble() {
        if (!this.flaskLiquid || !this.flaskLiquid.visible) return;
        if (this.bubbles.length > 15) return; // Limit bubbles

        const bubbleGeo = new THREE.SphereGeometry(0.03 + Math.random() * 0.03, 8, 8);
        const bubbleMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
            roughness: 0.1
        });

        const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);

        // Position at bottom of flask
        bubble.position.set(
            2.4 + (Math.random() - 0.5) * 0.4,
            -2.3 + Math.random() * 0.1,
            0.5 + (Math.random() - 0.5) * 0.3
        );

        bubble.userData = {
            speed: 0.01 + Math.random() * 0.015,
            wobble: Math.random() * Math.PI * 2
        };

        this.bubbles.push(bubble);
        this.scene.add(bubble);
    }

    // Update all particles
    updateParticles(time) {
        // Update dust motes
        if (this.dustParticles) {
            const positions = this.dustParticles.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i] += Math.sin(time + i) * 0.001;
                positions[i + 1] += Math.sin(time * 0.5 + i) * 0.0005;
                positions[i + 2] += Math.cos(time + i) * 0.001;
            }
            this.dustParticles.geometry.attributes.position.needsUpdate = true;
            this.dustParticles.rotation.y = time * 0.02;
        }

        // Update bubbles
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const bubble = this.bubbles[i];
            bubble.position.y += bubble.userData.speed;
            bubble.position.x += Math.sin(time * 3 + bubble.userData.wobble) * 0.002;

            // Pop bubble when it reaches liquid surface
            if (bubble.position.y > -1.9) {
                this.scene.remove(bubble);
                this.bubbles.splice(i, 1);
            }
        }

        // Occasionally spawn new bubbles
        if (Math.random() < 0.02 && this.flaskLiquid && this.flaskLiquid.visible) {
            this.createBubble();
        }
    }

    updateDrops() {
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const drop = this.drops[i];
            drop.position.y -= 0.08; // Gravity
            drop.position.z += 0.02; // Move towards flask (z=0.5)

            // Check if drop reached flask
            if (drop.position.y < -1.8) {
                this.scene.remove(drop);
                this.drops.splice(i, 1);
                this.createSplash();
            }
        }
    }

    createSplash() {
        // Ring splash effect
        const splashGeo = new THREE.RingGeometry(0.05, 0.15, 16);
        const splashMat = new THREE.MeshBasicMaterial({
            color: CONFIG.colors.edta,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        const splash = new THREE.Mesh(splashGeo, splashMat);
        splash.position.set(2.4, -1.8, 0.5);
        splash.rotation.x = -Math.PI / 2;
        this.scene.add(splash);

        // Create spray droplets
        const sprayDroplets = [];
        for (let i = 0; i < 8; i++) {
            const dropletGeo = new THREE.SphereGeometry(0.02, 8, 8);
            const dropletMat = new THREE.MeshStandardMaterial({
                color: CONFIG.colors.edta,
                transparent: true,
                opacity: 0.8,
                emissive: CONFIG.colors.edta,
                emissiveIntensity: 0.2
            });
            const droplet = new THREE.Mesh(dropletGeo, dropletMat);

            const angle = (i / 8) * Math.PI * 2;
            droplet.position.set(2.4, -1.75, 0.5);
            droplet.userData = {
                vx: Math.cos(angle) * 0.03,
                vy: 0.04 + Math.random() * 0.02,
                vz: Math.sin(angle) * 0.03
            };

            sprayDroplets.push(droplet);
            this.scene.add(droplet);
        }

        // Animate splash ring and droplets
        const startTime = Date.now();
        const animateSplash = () => {
            const elapsed = (Date.now() - startTime) / 1000;

            if (elapsed > 0.6) {
                this.scene.remove(splash);
                sprayDroplets.forEach(d => this.scene.remove(d));
                return;
            }

            // Animate ring
            const scale = 1 + elapsed * 4;
            splash.scale.set(scale, scale, 1);
            splash.material.opacity = 0.7 * (1 - elapsed * 1.5);

            // Animate spray droplets (parabolic arc)
            sprayDroplets.forEach(droplet => {
                droplet.position.x += droplet.userData.vx;
                droplet.position.y += droplet.userData.vy;
                droplet.position.z += droplet.userData.vz;
                droplet.userData.vy -= 0.004; // Gravity
                droplet.material.opacity = 0.8 * (1 - elapsed * 1.5);
            });

            requestAnimationFrame(animateSplash);
        };
        animateSplash();
    }

    // ============= PUBLIC API (called from lab.js) =============

    // Fill burette with EDTA
    fillBurette(percent = 100) {
        if (!this.buretteLiquid) return;
        const targetScale = percent / 100;
        this.animateValue(this.buretteLiquid.scale, 'y', targetScale, 1500);

        // Move liquid to correct position as it fills
        const targetY = -1.95 + (targetScale * 1.95);
        this.animateValue(this.buretteLiquid.position, 'y', targetY, 1500);
    }

    // Set burette liquid level (0-100%)
    setBuretteLiquidLevel(percent) {
        if (!this.buretteLiquid) return;
        const scale = percent / 100;
        this.buretteLiquid.scale.y = scale;
        this.buretteLiquid.position.y = -1.95 + (scale * 1.95);
    }

    // Fill flask with liquid (percent: 0-100)
    fillFlask(percent, color = null) {
        if (!this.flaskLiquid) return;

        // Make liquid visible
        this.flaskLiquid.visible = true;
        if (this.liquidSurface) this.liquidSurface.visible = true;

        // Scale based on percent (0 to 1 range for Y scale)
        const scaleY = Math.max(0.1, percent / 100); // Minimum 0.1 for visibility
        this.flaskLiquid.scale.y = scaleY;

        // Position liquid surface at top of liquid
        if (this.liquidSurface) {
            this.liquidSurface.position.y = -0.1 + (scaleY * 0.5);
        }

        if (color !== null) {
            this.setFlaskColor(color);
        }
    }

    // Update flask liquid level during titration
    setFlaskLevel(percent) {
        if (!this.flaskLiquid) return;
        this.flaskLiquid.visible = true;
        if (this.liquidSurface) this.liquidSurface.visible = true;

        const scaleY = Math.max(0.1, percent / 100);
        this.flaskLiquid.scale.y = scaleY;

        if (this.liquidSurface) {
            this.liquidSurface.position.y = -0.1 + (scaleY * 0.5);
        }
    }

    // Set flask liquid color (also updates emissive for glow)
    setFlaskColor(colorHex) {
        if (!this.flaskLiquidMat) return;
        const targetColor = new THREE.Color(colorHex);
        this.animateColor(this.flaskLiquidMat, targetColor, 500);

        // Also update emissive color for glow effect
        if (this.flaskLiquidMat.emissive) {
            this.flaskLiquidMat.emissive.copy(targetColor);
        }
    }

    // Create falling drop with formation animation
    createDrop() {
        const dropGeo = new THREE.SphereGeometry(0.06, 16, 16);
        // Elongate to teardrop shape
        dropGeo.scale(1, 1.5, 1);

        const dropMat = new THREE.MeshStandardMaterial({
            color: CONFIG.colors.edta,
            transparent: true,
            opacity: 0.9,
            emissive: CONFIG.colors.edta,
            emissiveIntensity: 0.15
        });

        const drop = new THREE.Mesh(dropGeo, dropMat);
        drop.position.set(2.4, -0.5, 0); // Start at burette tip
        drop.scale.set(0.1, 0.1, 0.1);   // Start tiny

        this.scene.add(drop);

        // Animate drop formation (grow then fall)
        const formDrop = () => {
            let progress = 0;
            const formationDuration = 200;
            const startTime = Date.now();

            const growThenFall = () => {
                const elapsed = Date.now() - startTime;
                progress = elapsed / formationDuration;

                if (progress < 1) {
                    // Growing phase
                    const scale = 0.1 + progress * 0.9;
                    drop.scale.set(scale, scale, scale);
                    drop.position.y = -0.5 - progress * 0.3;
                    requestAnimationFrame(growThenFall);
                } else {
                    // Formation complete, add to falling drops
                    drop.scale.set(1, 1, 1);
                    this.drops.push(drop);
                }
            };
            growThenFall();
        };
        formDrop();

        // Rotate stopcock handle briefly
        if (this.stopcockHandle) {
            this.stopcockHandle.rotation.z = Math.PI / 4;
            setTimeout(() => {
                this.stopcockHandle.rotation.z = 0;
            }, 150);
        }
    }

    // Shake flask effect
    shakeFlask() {
        if (!this.flask) return;
        const originalPos = this.flask.position.clone();
        const startTime = Date.now();

        const shake = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed > 300) {
                this.flask.position.copy(originalPos);
                return;
            }
            const intensity = 0.02 * (1 - elapsed / 300);
            this.flask.position.x = originalPos.x + (Math.random() - 0.5) * intensity;
            this.flask.position.z = originalPos.z + (Math.random() - 0.5) * intensity;
            requestAnimationFrame(shake);
        };
        shake();
    }

    // Animate bottle tilt when adding reagent
    animateBottle(bottleName) {
        const bottle = this.bottles.find(b => b.userData.name === bottleName);
        if (!bottle) return;

        const originalRotation = bottle.rotation.x;
        const startTime = Date.now();

        const tilt = () => {
            const elapsed = Date.now() - startTime;
            const duration = 1000;

            if (elapsed > duration) {
                bottle.rotation.z = originalRotation;
                return;
            }

            const progress = elapsed / duration;
            if (progress < 0.3) {
                bottle.rotation.z = -0.5 * (progress / 0.3);
            } else if (progress < 0.7) {
                bottle.rotation.z = -0.5;
            } else {
                bottle.rotation.z = -0.5 * (1 - (progress - 0.7) / 0.3);
            }

            requestAnimationFrame(tilt);
        };
        tilt();
    }

    // Helper: Animate a property
    animateValue(obj, prop, target, duration) {
        const start = obj[prop];
        const startTime = Date.now();

        const update = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = this.easeOutCubic(progress);
            obj[prop] = start + (target - start) * eased;

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };
        update();
    }

    // Helper: Animate color
    animateColor(material, targetColor, duration) {
        const startColor = material.color.clone();
        const startTime = Date.now();

        const update = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            material.color.lerpColors(startColor, targetColor, progress);

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };
        update();
    }

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    // Dispose and cleanup
    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.domElement.remove();
        }

        if (this.controls) {
            this.controls.dispose();
        }

        // Traverse and dispose all geometries and materials
        this.scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => m.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });

        this.isInitialized = false;
    }
}

// ============= 2D/3D TOGGLE MANAGER =============
class Lab3DToggle {
    constructor() {
        this.is3DMode = false;
        this.renderer3D = null;
        this.toggleBtn = null;
    }

    init() {
        this.createToggleButton();
        this.bindEvents();
    }

    createToggleButton() {
        this.toggleBtn = document.createElement('button');
        this.toggleBtn.id = 'toggle3DBtn';
        this.toggleBtn.className = 'header-btn toggle-3d-btn';
        this.toggleBtn.title = 'Toggle 3D View';
        this.toggleBtn.innerHTML = '🔲';

        const headerControls = document.querySelector('.header-controls');
        if (headerControls) {
            headerControls.insertBefore(this.toggleBtn, headerControls.firstChild);
        }
    }

    bindEvents() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggle());
        }
    }

    toggle() {
        this.is3DMode = !this.is3DMode;

        const equipmentArea = document.querySelector('.equipment-area');
        // Only hide burette and flask, NOT reagent shelf (needs to stay clickable)
        const apparatus2D = document.querySelectorAll('.burette-assembly, .flask-assembly');

        if (this.is3DMode) {
            // Enable 3D mode
            this.toggleBtn.innerHTML = '📋';
            this.toggleBtn.title = 'Switch to 2D View';
            equipmentArea.classList.add('mode-3d');

            // Hide only burette and flask (not reagent shelf)
            apparatus2D.forEach(el => el.style.display = 'none');

            // Initialize 3D renderer if not already
            if (!this.renderer3D) {
                this.renderer3D = new Lab3DRenderer('equipmentArea3D');
                window.lab3D = this.renderer3D; // Global reference for lab.js
            }

            // Sync current state
            this.syncState();
        } else {
            // Disable 3D mode
            this.toggleBtn.innerHTML = '🔲';
            this.toggleBtn.title = 'Switch to 3D View';
            equipmentArea.classList.remove('mode-3d');

            // Show 2D elements
            apparatus2D.forEach(el => el.style.display = '');
        }
    }

    syncState() {
        // Sync 3D renderer with current lab state
        if (!this.renderer3D || !window.lab) return;

        const state = window.lab.state;

        // Sync burette
        if (state.buretteReading > 0) {
            const liquidPercent = 100 - (parseFloat(state.buretteReading) * 1);
            this.renderer3D.setBuretteLiquidLevel(liquidPercent);
        }

        // Sync flask based on step
        if (state.step >= 1) {
            let flaskPercent = state.step >= 1 ? 30 : 0;
            if (state.step >= 2) flaskPercent = 40;
            if (state.step >= 5) flaskPercent = 40 + (state.dropsAdded * 0.1);

            let color = CONFIG.colors.water;
            if (state.flaskColor === 'wine-red') color = CONFIG.colors.wineRed;
            else if (state.flaskColor === 'purple') color = CONFIG.colors.purple;
            else if (state.flaskColor === 'blue') color = CONFIG.colors.blue;

            this.renderer3D.fillFlask(flaskPercent, color);
        }

        // Fill burette if past step 4
        if (state.step >= 5) {
            const liquidPercent = 100 - (parseFloat(state.buretteReading) * 1);
            this.renderer3D.fillBurette(liquidPercent);
        }
    }
}

// Export for use
window.Lab3DRenderer = Lab3DRenderer;
window.Lab3DToggle = Lab3DToggle;
