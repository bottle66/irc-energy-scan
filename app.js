(() => {
  const canvas = document.querySelector("#energy-canvas");
  const hero = document.querySelector("#hero");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (!canvas || !hero || reduceMotion.matches) return;

  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    powerPreference: "high-performance",
  });

  if (!gl) {
    canvas.hidden = true;
    return;
  }

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;

    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;

    varying vec2 v_uv;
    uniform sampler2D u_image;
    uniform vec2 u_resolution;
    uniform vec2 u_imageResolution;
    uniform float u_time;
    uniform vec2 u_rippleCenters[4];
    uniform float u_rippleAges[4];

    vec2 coverUv(vec2 uv) {
      float screenAspect = u_resolution.x / u_resolution.y;
      float imageAspect = u_imageResolution.x / u_imageResolution.y;
      vec2 scale = vec2(1.0);

      if (screenAspect > imageAspect) {
        scale.y = imageAspect / screenAspect;
      } else {
        scale.x = screenAspect / imageAspect;
      }

      return (uv - 0.5) * scale + 0.5;
    }

    float easeInOut(float value) {
      return value * value * (3.0 - 2.0 * value);
    }

    void main() {
      vec2 uv = v_uv;
      float aspect = u_resolution.x / u_resolution.y;
      float cycle = fract(u_time / 7.2);
      float travel = easeInOut(cycle);
      float scanCenter = mix(-0.34, 2.34, travel);
      float tangent = uv.x - uv.y;

      float irregularity = sin(tangent * 13.0 + u_time * 0.55) * 0.022;
      irregularity += sin(tangent * 31.0 - u_time * 0.28) * 0.009;
      irregularity += sin((uv.x + uv.y) * 17.0 + u_time * 0.42) * 0.005;

      float diagonal = uv.x + uv.y + irregularity;
      float distanceToBand = diagonal - scanCenter;
      float core = exp(-pow(distanceToBand * 11.0, 2.0));
      float innerGlow = exp(-pow(distanceToBand * 5.2, 2.0));
      float aura = exp(-pow(distanceToBand * 2.35, 2.0));
      float behindBand = max(-distanceToBand, 0.0);
      float scanAfterglow = step(distanceToBand, 0.0) * exp(-behindBand * 4.4);

      vec2 scanDirection = normalize(vec2(1.0, 1.0));
      float energyJitter = sin(tangent * 72.0 + u_time * 4.2) * core;
      vec2 distortedUv = uv + scanDirection * energyJitter * 0.0035;

      float clickRippleGlow = 0.0;
      float clickRippleSoftGlow = 0.0;
      vec2 clickRippleOffset = vec2(0.0);

      for (int i = 0; i < 4; i++) {
        float age = u_rippleAges[i];
        float active = step(0.0, age) * (1.0 - step(2.8, age));
        vec2 delta = vec2(
          (uv.x - u_rippleCenters[i].x) * aspect,
          uv.y - u_rippleCenters[i].y
        );
        float distanceFromClick = length(delta);
        float rippleLife = max(1.0 - age / 2.8, 0.0) * active;
        float rippleRadius = 0.02 + age * 0.76;
        float primaryRing = exp(-pow((distanceFromClick - rippleRadius) * 27.0, 2.0));
        float secondaryRing = exp(-pow((distanceFromClick - rippleRadius + 0.075) * 21.0, 2.0));
        float waveEnvelope = primaryRing + secondaryRing * 0.42;
        vec2 rippleDirection = delta / max(distanceFromClick, 0.001);

        clickRippleGlow += waveEnvelope * rippleLife;
        clickRippleSoftGlow += exp(-pow((distanceFromClick - rippleRadius) * 7.0, 2.0)) * rippleLife;
        clickRippleOffset += rippleDirection * waveEnvelope * rippleLife * 0.0045;
      }

      distortedUv += vec2(clickRippleOffset.x / aspect, clickRippleOffset.y);
      vec2 imageUv = coverUv(distortedUv);
      vec3 color = texture2D(u_image, imageUv).rgb;

      vec2 pixel = 2.4 / u_imageResolution;
      vec3 nearbyX = texture2D(u_image, imageUv + vec2(pixel.x, 0.0)).rgb;
      vec3 nearbyY = texture2D(u_image, imageUv + vec2(0.0, pixel.y)).rgb;
      float microContrast = length(color - nearbyX) + length(color - nearbyY);
      float bluePresence = smoothstep(0.08, 0.72, max(color.b, color.g) - color.r * 0.28);
      float logoDetail = smoothstep(0.035, 0.19, microContrast) * bluePresence;

      float colorShift = 0.5 + 0.5 * sin(tangent * 12.0 + u_time * 0.9);
      vec3 electricBlue = vec3(0.10, 0.36, 1.0);
      vec3 electricCyan = vec3(0.08, 1.0, 0.86);
      vec3 energyColor = mix(electricBlue, electricCyan, colorShift);

      float logoActivation = core * (0.18 + logoDetail * 0.82);
      color = mix(color, energyColor * (0.88 + color.b * 0.42), logoActivation);
      color += energyColor * innerGlow * (0.035 + logoDetail * 0.12);
      color += vec3(0.04, 0.10, 0.22) * aura * 0.42;
      color = mix(color, energyColor * (0.78 + color.b * 0.48), scanAfterglow * logoDetail * 0.22);

      float centerCross = exp(-pow((scanCenter - 1.0) * 4.7, 2.0));
      vec2 centerDelta = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
      float centerDistance = length(centerDelta);
      float haloSize = 0.18 + centerCross * 0.26;
      float centerHalo = exp(-pow(centerDistance / haloSize, 2.0)) * centerCross;
      color += vec3(0.05, 0.42, 0.66) * centerHalo * 0.42;

      if (cycle >= 0.5 && cycle < 0.94) {
        float pulseProgress = (cycle - 0.5) / 0.44;
        float pulseEase = 1.0 - pow(1.0 - pulseProgress, 2.4);
        float pulseLife = pow(1.0 - pulseProgress, 0.78);
        float pulseRadius = mix(0.06, 1.34, pulseEase);
        float pulseRing = exp(-pow((centerDistance - pulseRadius) * 18.0, 2.0));
        float pulseGlow = exp(-pow((centerDistance - pulseRadius) * 5.4, 2.0));
        float expandingHalo = (1.0 - smoothstep(pulseRadius - 0.24, pulseRadius, centerDistance)) * pulseLife;

        color += vec3(0.08, 0.72, 1.0) * pulseRing * pulseLife * 0.34;
        color += vec3(0.03, 0.32, 0.78) * pulseGlow * pulseLife * 0.12;
        color += vec3(0.02, 0.12, 0.28) * expandingHalo * 0.16;
      }

      color += vec3(0.05, 0.82, 1.0) * clickRippleGlow * 0.34;
      color += vec3(0.02, 0.24, 0.60) * clickRippleSoftGlow * 0.12;

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || "Shader compilation failed");
    }
    return shader;
  };

  let program;
  try {
    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "Shader link failed");
    }
  } catch (error) {
    canvas.hidden = true;
    return;
  }

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const positionLocation = gl.getAttribLocation(program, "a_position");
  const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
  const imageResolutionLocation = gl.getUniformLocation(program, "u_imageResolution");
  const timeLocation = gl.getUniformLocation(program, "u_time");
  const imageLocation = gl.getUniformLocation(program, "u_image");
  const rippleCentersLocation = gl.getUniformLocation(program, "u_rippleCenters[0]");
  const rippleAgesLocation = gl.getUniformLocation(program, "u_rippleAges[0]");

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  let effectEpoch = performance.now() / 1000;
  const rippleEvents = [];
  const inactiveRippleAge = -10;

  const resize = () => {
    const rect = hero.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  };

  const image = new Image();
  image.src = "./assets/raw-2.png";
  image.addEventListener("load", () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(imageLocation, 0);
    gl.uniform2f(imageResolutionLocation, image.naturalWidth, image.naturalHeight);

    resize();
    requestAnimationFrame(render);
  });

  image.addEventListener("error", () => {
    canvas.hidden = true;
  });

  const render = (timestamp) => {
    const now = timestamp / 1000 - effectEpoch;
    resize();

    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, now);

    const rippleCenters = new Float32Array(8);
    const rippleAges = new Float32Array(4);
    rippleAges.fill(inactiveRippleAge);

    rippleEvents.forEach((ripple, index) => {
      rippleCenters[index * 2] = ripple.x;
      rippleCenters[index * 2 + 1] = ripple.y;
      rippleAges[index] = timestamp / 1000 - ripple.startedAt;
    });

    gl.uniform2fv(rippleCentersLocation, rippleCenters);
    gl.uniform1fv(rippleAgesLocation, rippleAges);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    for (let index = rippleEvents.length - 1; index >= 0; index -= 1) {
      if (timestamp / 1000 - rippleEvents[index].startedAt >= 2.8) {
        rippleEvents.splice(index, 1);
      }
    }

    requestAnimationFrame(render);
  };

  hero.addEventListener("pointerdown", (event) => {
    if (event.target.closest("a")) return;

    const rect = hero.getBoundingClientRect();
    const ripple = {
      x: (event.clientX - rect.left) / rect.width,
      y: 1 - (event.clientY - rect.top) / rect.height,
      startedAt: performance.now() / 1000,
    };

    rippleEvents.push(ripple);
    if (rippleEvents.length > 4) rippleEvents.shift();
  });

  window.addEventListener("resize", resize, { passive: true });
})();
