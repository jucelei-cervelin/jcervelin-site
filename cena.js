(function () {
  'use strict';

  // Cena: um galpão começa como planta e ganha estrutura conforme a rolagem.
  // "s" mede a rolagem em passos: s = 2 significa painel 2 (porta-palete) na tela.

  var WHATS = 'https://wa.me/5547991735060?text=' +
    encodeURIComponent('Olá! Vim pelo site e quero um orçamento de armazenagem.');
  document.querySelectorAll('[data-whats]').forEach(function (a) {
    a.href = WHATS;
    a.target = '_blank';
    a.rel = 'noopener';
  });

  // O convite para rolar some assim que a pessoa começa a descer
  var rolar = document.querySelector('.rolar');
  function marcaRolagem() { rolar.classList.toggle('saiu', scrollY > 60); }
  addEventListener('scroll', marcaRolagem, { passive: true });
  marcaRolagem();

  var COR = {
    planta: 0x070d15, plantaPiso: 0x0c1824, linha: 0x5db4ea,
    fundo: 0xdde5ed, piso: 0xc6d0db, parede: 0xeef2f6, rodape: 0xa3adb8, viga: 0x5d6975,
    azul: 0x0f679f, laranja: 0xe8590c, amarelo: 0x3a97d6, madeira: 0xb98a55,
    cinza: 0x8e989f, tubo: 0x9aa3ab, filme: 0xdfe3e6
  };
  var KRAFT = [0xc9a36b, 0xbf9458, 0xd4b27f, 0xb5875a, 0xcdb18a];

  var canvas = document.getElementById('cena');
  var obra = document.getElementById('obra');
  var reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var celular = innerWidth < 860;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  } catch (e) {
    document.body.classList.add('sem-3d');
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, celular ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(COR.planta);
  scene.fog = new THREE.Fog(COR.planta, 75, 280);
  var camera = new THREE.PerspectiveCamera(28, 1, 1, 400);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xbdb6a8, 1.9));
  var sol = new THREE.DirectionalLight(0xfff4e4, 2.1);
  sol.position.set(26, 42, 22);
  sol.castShadow = true;
  sol.shadow.mapSize.set(celular ? 1024 : 2048, celular ? 1024 : 2048);
  sol.shadow.camera.left = -34; sol.shadow.camera.right = 34;
  sol.shadow.camera.top = 30; sol.shadow.camera.bottom = -30;
  sol.shadow.camera.far = 110;
  sol.shadow.bias = -0.0006;
  scene.add(sol);

  // Apoio
  var V3 = THREE.Vector3;
  var clamp = function (v) { return Math.min(1, Math.max(0, v)); };
  var faixa = function (s, a, b) { return clamp((s - a) / (b - a)); };
  var suave = function (t) { return t * t * (3 - 2 * t); };
  var saida = function (t) { return 1 - Math.pow(1 - t, 3); };
  var semente = 42;
  var sorte = function () {
    semente = (semente * 16807) % 2147483647;
    return (semente - 1) / 2147483646;
  };

  // Lote: um InstancedMesh em que cada peça tem sua própria janela de entrada.
  var Q0 = new THREE.Quaternion();
  var cubo = new THREE.BoxGeometry(1, 1, 1);
  var cilindro = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  cilindro.rotateZ(Math.PI / 2);

  function material(cor, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: cor, roughness: 0.62, metalness: 0.08 }, extra || {}));
  }
  function lote(geo, mat) { return { geo: geo, mat: mat, itens: [], mesh: null }; }

  var L = {
    azul: lote(cubo, material(COR.azul)),
    laranja: lote(cubo, material(COR.laranja)),
    amarelo: lote(cubo, material(COR.amarelo)),
    madeira: lote(cubo, material(0xffffff, { roughness: 0.85 })),
    caixa: lote(cubo, material(0xffffff, { roughness: 0.9 })),
    cinza: lote(cubo, material(COR.cinza, { roughness: 0.5, metalness: 0.2 })),
    tubo: lote(cilindro, material(COR.tubo, { roughness: 0.38, metalness: 0.35 }))
  };

  function poe(l, x, y, z, ex, ey, ez, o) {
    l.itens.push({
      p: new V3(x, y, z), e: new V3(ex, ey, ez),
      q: o.q || Q0, ini: o.ini, fim: o.fim,
      tipo: o.tipo || 'sobe', d: o.d || null, eixo: o.eixo || 'x',
      cor: o.cor === undefined ? null : o.cor, k: -1
    });
  }

  var mAux = new THREE.Matrix4(), pAux = new V3(), eAux = new V3(), cAux = new THREE.Color();

  function fecha(l) {
    var m = new THREE.InstancedMesh(l.geo, l.mat, l.itens.length);
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    l.itens.forEach(function (it, i) {
      if (it.cor !== null) m.setColorAt(i, cAux.setHex(it.cor));
      else if (l === L.madeira || l === L.caixa) m.setColorAt(i, cAux.setHex(COR.madeira));
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    l.mesh = m;
    scene.add(m);
  }

  function anima(l, s) {
    var mudou = false;
    for (var i = 0; i < l.itens.length; i++) {
      var it = l.itens[i];
      var k = saida(faixa(s, it.ini, it.fim));
      if (k === it.k) continue;
      it.k = k;
      mudou = true;
      if (k <= 0) {
        mAux.makeScale(0, 0, 0);
      } else {
        pAux.copy(it.p);
        eAux.copy(it.e);
        if (it.tipo === 'sobe') {
          pAux.y -= it.e.y * (1 - k) / 2;
          eAux.y = it.e.y * k;
        } else if (it.tipo === 'estende') {
          eAux[it.eixo] = it.e[it.eixo] * k;
        } else if (it.tipo === 'desliza') {
          pAux.addScaledVector(it.d, 1 - k);
          eAux.multiplyScalar(Math.min(1, k * 7));
        }
        mAux.compose(pAux, it.q, eAux);
      }
      l.mesh.setMatrixAt(i, mAux);
    }
    if (mudou) l.mesh.instanceMatrix.needsUpdate = true;
  }

  function paleteComCarga(x, y, z, o) {
    poe(L.madeira, x, y + 0.07, z, o.lx || 1.0, 0.14, o.lz || 1.2, { tipo: 'desliza', d: o.d, ini: o.ini, fim: o.fim, cor: COR.madeira });
    var h = o.h || 0.8 + sorte() * 0.45;
    var cor = o.cor === undefined ? KRAFT[Math.floor(sorte() * KRAFT.length)] : o.cor;
    poe(L.caixa, x, y + 0.14 + h / 2, z, (o.lx || 1.0) - 0.06, h, (o.lz || 1.2) - 0.08, { tipo: 'desliza', d: o.d, ini: o.ini, fim: o.fim, cor: cor });
  }

  // Porta-palete: colunas sobem, longarinas travam, paletes entram pelo corredor.
  var BAIA = 2.8, FUNDO = 1.1, NIVEL = 1.72;

  function portaPalete(c) {
    var H = c.niveis * NIVEL + 0.4;
    var i, n, y;
    for (i = 0; i <= c.baias; i++) {
      var x = c.x + i * BAIA;
      var ini = 1.5 + (i / c.baias) * 0.32 + c.atraso;
      [c.z, c.z + FUNDO].forEach(function (zz) {
        poe(L.azul, x, H / 2, zz, 0.1, H, 0.09, { ini: ini, fim: ini + 0.2 });
      });
      var passo = 1.3, hip = Math.hypot(passo, FUNDO);
      var q = new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), -Math.atan2(passo, FUNDO));
      for (y = 0.35; y + passo < H; y += passo) {
        poe(L.azul, x, y, c.z + FUNDO / 2, 0.045, 0.045, FUNDO, { tipo: 'estende', eixo: 'z', ini: ini + 0.1, fim: ini + 0.24 });
        poe(L.azul, x, y + passo / 2, c.z + FUNDO / 2, 0.035, 0.035, hip, { tipo: 'estende', eixo: 'z', ini: ini + 0.12, fim: ini + 0.26, q: q });
      }
    }
    for (n = 1; n <= c.niveis; n++) {
      y = n * NIVEL - 0.42;
      for (i = 0; i < c.baias; i++) {
        var iniL = 1.8 + (n / c.niveis) * 0.26 + i * 0.012 + c.atraso;
        [c.z, c.z + FUNDO].forEach(function (zz) {
          poe(L.laranja, c.x + (i + 0.5) * BAIA, y, zz, BAIA - 0.1, 0.13, 0.05, { tipo: 'estende', ini: iniL, fim: iniL + 0.14 });
        });
      }
    }
    for (n = 0; n <= c.niveis; n++) {
      y = n === 0 ? 0.02 : n * NIVEL - 0.35;
      for (i = 0; i < c.baias; i++) {
        [0.27, 0.73].forEach(function (f) {
          if (sorte() < 0.1) return;
          var iniP = 2.06 + (n / (c.niveis + 1)) * 0.36 + sorte() * 0.16 + c.atraso;
          paleteComCarga(c.x + (i + f) * BAIA, y, c.z + FUNDO / 2, {
            d: new V3(0, 0.3, c.lado * 2.6), ini: iniP, fim: iniP + 0.14,
            h: Math.min(0.8 + sorte() * 0.5, 1.22)
          });
        });
      }
    }
  }

  // Drive-in: blocos sem corredor, com a mesma carga em todas as vias.
  function driveIn(c) {
    var LARG = 1.42, PROF = 1.25, H = c.niveis * NIVEL + 0.3;
    var i, j, n;
    for (i = 0; i <= c.vias; i++) {
      for (j = 0; j <= c.prof; j += 2) {
        var ini = 2.62 + (i / c.vias) * 0.22 + j * 0.01;
        poe(L.azul, c.x + i * LARG, H / 2, c.z + j * PROF, 0.1, H, 0.09, { ini: ini, fim: ini + 0.2 });
      }
      for (n = 1; n <= c.niveis; n++) {
        var iniT = 2.84 + (n / c.niveis) * 0.14;
        poe(L.laranja, c.x + i * LARG, n * NIVEL - 0.42, c.z + (c.prof * PROF) / 2, 0.11, 0.07, c.prof * PROF, { tipo: 'estende', eixo: 'z', ini: iniT, fim: iniT + 0.14 });
      }
    }
    for (j = 0; j <= c.prof; j += 2) {
      poe(L.azul, c.x + (c.vias * LARG) / 2, H - 0.03, c.z + j * PROF, c.vias * LARG, 0.09, 0.09, { tipo: 'estende', ini: 2.96, fim: 3.1 });
    }
    for (n = 0; n <= c.niveis; n++) {
      var y = n === 0 ? 0.02 : n * NIVEL - 0.37;
      if (n === c.niveis) break;
      for (i = 0; i < c.vias; i++) {
        for (j = 0; j < c.prof; j++) {
          var iniP = 3.02 + (n / c.niveis) * 0.26 + ((c.prof - j) / c.prof) * 0.14 + i * 0.012;
          paleteComCarga(c.x + (i + 0.5) * LARG, y, c.z + (c.prof - j - 0.5) * PROF, {
            lx: 1.2, lz: 1.08, h: 1.16, cor: COR.filme,
            d: new V3(0, 0, (j + 1) * PROF + 1.5), ini: iniP, fim: iniP + 0.16
          });
        }
      }
    }
  }

  // Mezanino: colunas, vigas, piso, guarda-corpo e escada.
  function mezanino(c) {
    var h = c.h, i, j;
    var x1 = c.x + c.nx * c.vx, z1 = c.z + c.nz * c.vz;
    for (i = 0; i <= c.nx; i++) {
      for (j = 0; j <= c.nz; j++) {
        var ini = 3.6 + (i + j) * 0.016;
        poe(L.azul, c.x + i * c.vx, h / 2, c.z + j * c.vz, 0.2, h, 0.2, { ini: ini, fim: ini + 0.2 });
      }
    }
    for (j = 0; j <= c.nz; j++) {
      poe(L.azul, (c.x + x1) / 2, h - 0.2, c.z + j * c.vz, x1 - c.x, 0.3, 0.14, { tipo: 'estende', ini: 3.82, fim: 3.98 });
    }
    for (i = 0; i <= c.nx; i++) {
      poe(L.azul, c.x + i * c.vx, h - 0.2, (c.z + z1) / 2, 0.14, 0.3, z1 - c.z, { tipo: 'estende', eixo: 'z', ini: 3.86, fim: 4.02 });
    }
    var T = 2, nt = Math.round((x1 - c.x) / T), mt = Math.round((z1 - c.z) / T);
    for (i = 0; i < nt; i++) {
      for (j = 0; j < mt; j++) {
        var iniP = 3.96 + ((i + j) / (nt + mt)) * 0.24;
        poe(L.cinza, c.x + (i + 0.5) * T, h + 0.03, c.z + (j + 0.5) * T, T - 0.03, 0.14, T - 0.03, { tipo: 'desliza', d: new V3(0, 2.2, 0), ini: iniP, fim: iniP + 0.14 });
      }
    }
    var guarda = function (x, z, comp, eixo) {
      var ex = eixo === 'x' ? comp : 0.05, ez = eixo === 'z' ? comp : 0.05;
      [0.55, 1.1].forEach(function (a) {
        poe(L.amarelo, x, h + a, z, ex, 0.05, ez, { tipo: 'estende', eixo: eixo, ini: 4.2, fim: 4.34 });
      });
      for (var t = 0; t <= Math.round(comp / 1.5); t++) {
        var f = t / Math.round(comp / 1.5) - 0.5;
        poe(L.amarelo, x + (eixo === 'x' ? f * comp : 0), h + 0.55, z + (eixo === 'z' ? f * comp : 0), 0.07, 1.1, 0.07, { ini: 4.16, fim: 4.28 });
      }
    };
    guarda((c.x + x1) / 2, z1, x1 - c.x, 'x');
    var meio = (c.z + z1) / 2, vao = 0.8;
    guarda(x1, (c.z + meio - vao) / 2, meio - vao - c.z, 'z');
    guarda(x1, (meio + vao + z1) / 2, z1 - meio - vao, 'z');

    var degraus = 12, sobe = h / degraus, avanca = 0.34;
    var comp = degraus * avanca, hip = Math.hypot(h, comp);
    var qEsc = new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), -Math.atan2(h, comp));
    for (i = 0; i < degraus; i++) {
      var iniD = 4.2 + (i / degraus) * 0.2;
      poe(L.cinza, x1 + comp - (i + 0.5) * avanca, (i + 1) * sobe - 0.03, meio, 0.32, 0.07, 1.24, { ini: iniD, fim: iniD + 0.1 });
    }
    [-0.66, 0.66].forEach(function (dz) {
      poe(L.amarelo, x1 + comp / 2, h / 2 - 0.08, meio + dz, hip, 0.2, 0.07, { tipo: 'estende', q: qEsc, ini: 4.2, fim: 4.38 });
      poe(L.amarelo, x1 + comp / 2, h / 2 + 1, meio + dz, hip, 0.06, 0.05, { tipo: 'estende', q: qEsc, ini: 4.3, fim: 4.46 });
    });

    for (i = 0; i < 5; i++) {
      for (j = 0; j < 3; j++) {
        var iniC = 4.34 + sorte() * 0.3;
        paleteComCarga(c.x + 1.3 + i * 2.3, h + 0.1, c.z + 1.1 + j * 1.75, { d: new V3(0, 2.6, 0), ini: iniC, fim: iniC + 0.14 });
      }
    }
  }

  // Cantilever: torres no centro, braços nos dois lados, carga longa pela lateral.
  function cantilever(c) {
    var H = 5, i, n, comp = (c.torres - 1) * c.vao + 2;
    var alturas = [1.15, 2.2, 3.25, 4.3];
    var xm = c.x + ((c.torres - 1) * c.vao) / 2;
    for (i = 0; i < c.torres; i++) {
      var x = c.x + i * c.vao, ini = 4.62 + (i / c.torres) * 0.26;
      poe(L.azul, x, H / 2, c.z, 0.28, H, 0.42, { ini: ini, fim: ini + 0.22 });
      poe(L.azul, x, 0.08, c.z, 0.28, 0.16, 3.5, { tipo: 'estende', eixo: 'z', ini: ini, fim: ini + 0.14 });
      alturas.forEach(function (y, a) {
        [-1, 1].forEach(function (lado) {
          var iniB = 4.84 + a * 0.05 + i * 0.012;
          poe(L.laranja, x, y, c.z + lado * 0.95, 0.15, 0.16, 1.5, { tipo: 'estende', eixo: 'z', ini: iniB, fim: iniB + 0.14 });
        });
      });
    }
    [-1, 1].forEach(function (lado) {
      alturas.forEach(function (y, a) {
        var ini = 5.04 + a * 0.08 + (lado > 0 ? 0 : 0.05);
        var d = new V3(26, 0.2, 0);
        if ((a + (lado > 0 ? 0 : 1)) % 2 === 0) {
          for (n = 0; n < 7; n++) {
            var zt = c.z + lado * (0.42 + n * 0.17);
            poe(L.tubo, xm, y + 0.16, zt, comp, 0.15, 0.15, { tipo: 'desliza', d: d, ini: ini + n * 0.012, fim: ini + 0.2 + n * 0.012 });
          }
          for (n = 0; n < 5; n++) {
            poe(L.tubo, xm, y + 0.29, c.z + lado * (0.5 + n * 0.19), comp, 0.13, 0.13, { tipo: 'desliza', d: d, ini: ini + 0.05 + n * 0.012, fim: ini + 0.25 + n * 0.012 });
          }
        } else {
          for (n = 0; n < 5; n++) {
            poe(L.madeira, xm, y + 0.17, c.z + lado * (0.52 + n * 0.25), comp, 0.1, 0.22, { tipo: 'desliza', d: d, ini: ini + n * 0.014, fim: ini + 0.2 + n * 0.014, cor: n % 2 ? 0xc99d67 : 0xb98a55 });
            poe(L.madeira, xm, y + 0.27, c.z + lado * (0.52 + n * 0.25), comp, 0.1, 0.22, { tipo: 'desliza', d: d, ini: ini + 0.05 + n * 0.014, fim: ini + 0.25 + n * 0.014, cor: n % 2 ? 0xb98a55 : 0xd2ab78 });
          }
        }
      });
    });
  }

  // Galpão
  var GX = 21, GZ = 13, GH = 11;
  var galpao = new THREE.Group();
  scene.add(galpao);

  var matPiso = material(COR.plantaPiso, { roughness: 0.92, metalness: 0 });
  var piso = new THREE.Mesh(new THREE.BoxGeometry(GX * 2, 0.5, GZ * 2), matPiso);
  piso.position.y = -0.25;
  piso.receiveShadow = true;
  galpao.add(piso);

  var matParede = material(COR.parede, { transparent: true, opacity: 0, roughness: 0.9 });
  var matRodape = material(COR.rodape, { transparent: true, opacity: 0, roughness: 0.9 });
  var matViga = material(COR.viga, { transparent: true, opacity: 0 });
  function caixa(ex, ey, ez, x, y, z, mat, sombra) {
    var m = new THREE.Mesh(cubo, mat);
    m.scale.set(ex, ey, ez);
    m.position.set(x, y, z);
    m.castShadow = !!sombra;
    m.receiveShadow = true;
    galpao.add(m);
    return m;
  }
  caixa(GX * 2 + 0.4, GH, 0.2, 0, GH / 2, -GZ - 0.1, matParede);
  caixa(0.2, GH, GZ * 2, -GX - 0.1, GH / 2, 0, matParede);
  caixa(GX * 2 + 0.4, 1.3, 0.24, 0, 0.65, -GZ - 0.08, matRodape);
  caixa(0.24, 1.3, GZ * 2, -GX - 0.08, 0.65, 0, matRodape);
  var i;
  for (i = 0; i <= 7; i++) caixa(0.3, GH, 0.34, -GX + i * 6, GH / 2, -GZ + 0.1, matViga);
  for (i = 1; i <= 4; i++) caixa(0.34, GH, 0.3, -GX + 0.1, GH / 2, -GZ + i * 5.2, matViga);
  caixa(GX * 2, 0.4, 0.34, 0, GH - 0.2, -GZ + 0.1, matViga);
  caixa(0.34, 0.4, GZ * 2, -GX + 0.1, GH - 0.2, 0, matViga);

  // Faixas de corredor no piso
  poe(L.amarelo, 0, 0.012, -5.1, GX * 2 - 1, 0.012, 0.12, { tipo: 'estende', ini: 1.7, fim: 2.1 });
  poe(L.amarelo, 0, 0.012, 1.4, GX * 2 - 1, 0.012, 0.12, { tipo: 'estende', ini: 1.75, fim: 2.15 });

  // Estruturas, da mais alta (fundo) para a mais baixa (frente)
  portaPalete({ x: 0, z: -12.5, baias: 7, niveis: 5, lado: 1, atraso: 0.08 });
  portaPalete({ x: 0, z: -8.1, baias: 7, niveis: 5, lado: -1, atraso: 0.04 });
  portaPalete({ x: 0, z: -6.9, baias: 7, niveis: 5, lado: 1, atraso: 0 });
  driveIn({ x: 3.6, z: 2.5, vias: 9, prof: 6, niveis: 3 });
  mezanino({ x: -19.6, z: -11.6, nx: 4, nz: 3, vx: 3.5, vz: 3.2, h: 3.6 });
  cantilever({ x: -18.5, z: 7.2, torres: 5, vao: 3.3 });
  Object.keys(L).forEach(function (k) { fecha(L[k]); });

  // Planta: grade, contorno do galpão, zonas e fantasmas das estruturas
  function segmentos(pontos, cor, opac) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pontos, 3));
    var m = new THREE.LineBasicMaterial({ color: cor, transparent: true, opacity: opac });
    var l = new THREE.LineSegments(g, m);
    l.frustumCulled = false;
    scene.add(l);
    return l;
  }
  function retangulo(p, x0, z0, x1, z1, y) {
    p.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
  }
  function caixote(p, x0, z0, x1, z1, h) {
    retangulo(p, x0, z0, x1, z1, h);
    [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].forEach(function (c) {
      p.push(c[0], 0, c[1], c[0], h, c[1]);
    });
  }

  var pGrade = [];
  for (i = -GX; i <= GX; i += 2) pGrade.push(i, 0.02, -GZ, i, 0.02, GZ);
  for (i = -GZ; i <= GZ; i += 2) pGrade.push(-GX, 0.02, i, GX, 0.02, i);
  var grade = segmentos(pGrade, COR.linha, 0.16);

  var pGalpao = [];
  caixote(pGalpao, -GX, -GZ, GX, GZ, 0);
  [[-GX, -GZ], [GX, -GZ], [-GX, GZ]].forEach(function (c) { pGalpao.push(c[0], 0, c[1], c[0], GH, c[1]); });
  pGalpao.push(-GX, GH, -GZ, GX, GH, -GZ, -GX, GH, -GZ, -GX, GH, GZ);
  for (i = 0; i <= 7; i++) pGalpao.push(-GX + i * 6, 0, -GZ, -GX + i * 6, GH, -GZ);
  for (i = 1; i <= 4; i++) pGalpao.push(-GX, 0, -GZ + i * 5.2, -GX, GH, -GZ + i * 5.2);
  // Cota do pé-direito
  var cx = GX + 1.6;
  pGalpao.push(cx, 0, -GZ, cx, GH, -GZ, cx - 0.5, 0, -GZ, cx + 0.5, 0, -GZ, cx - 0.5, GH, -GZ, cx + 0.5, GH, -GZ);
  var contorno = segmentos(pGalpao, COR.linha, 0.9);

  var ZONAS = [
    [0, -12.5, 19.6, -11.4, 8.8], [0, -8.1, 19.6, -5.8, 8.8],
    [3.6, 2.5, 16.4, 10, 5.5], [-19.6, -11.6, -5.6, -2, 3.6], [-18.5, 5.4, -5.3, 9, 5]
  ];
  var pPlano = [];
  ZONAS.forEach(function (z) { retangulo(pPlano, z[0], z[1], z[2], z[3], 0.03); });
  var plano = segmentos(pPlano, 0xffffff, 0.95);
  var pFantasma = [];
  ZONAS.forEach(function (z) { caixote(pFantasma, z[0], z[1], z[2], z[3], z[4]); });
  var fantasma = segmentos(pFantasma, COR.linha, 0.6);

  // Empilhadeira
  var empilhadeira = new THREE.Group();
  (function () {
    var corpo = material(COR.laranja), preto = material(0x20272d, { roughness: 0.8 }), garfo = material(0x3b444c);
    function p(ex, ey, ez, x, y, z, m) {
      var b = new THREE.Mesh(cubo, m);
      b.scale.set(ex, ey, ez); b.position.set(x, y, z); b.castShadow = true;
      empilhadeira.add(b);
    }
    p(2.0, 0.85, 1.15, 0, 0.72, 0, corpo);
    p(0.9, 0.3, 1.0, 0.45, 1.27, 0, preto);
    [[-0.35, -0.5], [-0.35, 0.5], [0.85, -0.5], [0.85, 0.5]].forEach(function (c) { p(0.07, 1.25, 0.07, c[0], 1.75, c[1], preto); });
    p(1.4, 0.07, 1.14, 0.25, 2.38, 0, preto);
    p(0.1, 3, 0.1, -1.08, 1.6, -0.36, garfo);
    p(0.1, 3, 0.1, -1.08, 1.6, 0.36, garfo);
    p(0.08, 0.5, 0.9, -1.14, 0.5, 0, garfo);
    p(1.2, 0.05, 0.12, -1.7, 0.3, -0.3, garfo);
    p(1.2, 0.05, 0.12, -1.7, 0.3, 0.3, garfo);
    var pneu = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 16);
    pneu.rotateX(Math.PI / 2);
    [[-0.7, -0.55], [-0.7, 0.55], [0.72, -0.55], [0.72, 0.55]].forEach(function (c) {
      var r = new THREE.Mesh(pneu, preto);
      r.position.set(c[0], 0.33, c[1]); r.castShadow = true;
      empilhadeira.add(r);
    });
    p(1.1, 0.14, 1.0, -1.75, 0.41, 0, material(COR.madeira, { roughness: 0.85 }));
    p(1.04, 1.05, 0.94, -1.75, 1.0, 0, material(KRAFT[0], { roughness: 0.9 }));
    empilhadeira.visible = false;
    scene.add(empilhadeira);
  })();

  // Etiquetas em HTML, presas a pontos da cena
  var ETIQ = [
    { t: 'PÉ-DIREITO', p: [GX + 1.6, 6.4, -GZ], a: -1, b: 0.62, c: 'na-planta' },
    { t: 'PORTA-PALETE', p: [10, 0, -9.2], a: 0.62, b: 1.34, c: 'na-planta' },
    { t: 'DRIVE-IN', p: [10, 0, 6.2], a: 0.68, b: 1.34, c: 'na-planta' },
    { t: 'MEZANINO', p: [-12.6, 0, -6.8], a: 0.74, b: 1.34, c: 'na-planta' },
    { t: 'CANTILEVER', p: [-12, 0, 7.2], a: 0.8, b: 1.34, c: 'na-planta' },
    { t: 'COLUNA', p: [19.6, 9.1, -5.9], a: 1.72, b: 2.62, c: 'na-obra parte' },
    { t: 'LONGARINA', p: [12.6, 4.74, -5.8], a: 1.98, b: 2.62, c: 'na-obra parte' },
    { t: 'PALETE', p: [7.6, 1.5, -5.8], a: 2.28, b: 2.62, c: 'na-obra parte' }
  ].map(function (e) {
    var el = document.createElement('div');
    el.className = 'etiqueta ' + e.c;
    el.textContent = e.t;
    document.getElementById('etiquetas').appendChild(el);
    e.el = el;
    e.v = new V3().fromArray(e.p);
    return e;
  });

  // Percurso da câmera: posição e alvo em cada passo
  var CAM = [
    { s: 0.0, p: [37, 19, 39], a: [-1, 4.5, -2] },
    { s: 1.0, p: [3, 66, 13], a: [0, 0, -0.6] },
    { s: 1.36, p: [10, 44, 28], a: [2, 1, -4] },
    { s: 2.25, p: [33, 14, 12], a: [9, 4.2, -8] },
    { s: 3.2, p: [34, 13, 31], a: [9, 2.2, 3] },
    { s: 4.25, p: [13, 12, 21], a: [-11, 2.8, -6] },
    { s: 5.25, p: [10, 10, 27], a: [-11.5, 2.3, 6.6] },
    { s: 6.2, p: [38, 25, 41], a: [-1, 2.8, -1] }
  ];
  var pos = new V3(), alvoCam = new V3(), va = new V3(), vb = new V3();

  function cameraEm(s) {
    var i = 0;
    while (i < CAM.length - 2 && s > CAM[i + 1].s) i++;
    var a = CAM[i], b = CAM[i + 1];
    var t = suave(faixa(s, a.s, b.s));
    pos.copy(va.fromArray(a.p)).lerp(vb.fromArray(b.p), t);
    alvoCam.copy(va.fromArray(a.a)).lerp(vb.fromArray(b.a), t);
    // Em tela estreita a câmera recua para o galpão caber na largura
    pos.sub(alvoCam).multiplyScalar(zoomTela).add(alvoCam);
    // No celular o galpão começa abaixo do título e sobe para dar lugar ao painel de baixo
    // No computador ele começa mais à direita, longe do título da abertura
    if (celular) {
      camera.setViewOffset(telaW, telaH, 0, -telaH * 0.16, telaW, telaH);
    } else {
      camera.setViewOffset(telaW, telaH, -telaW * (0.25 - 0.12 * suave(faixa(s, 0.2, 0.9))), 0, telaW, telaH);
    }
    camera.position.copy(pos);
    camera.lookAt(alvoCam);
  }

  var cPlanta = new THREE.Color(COR.planta), cFundo = new THREE.Color(COR.fundo);
  var cPisoA = new THREE.Color(COR.plantaPiso), cPisoB = new THREE.Color(COR.piso);
  var telaW = 1, telaH = 1, zoomTela = 1, passoH = 1, sMax = 6.3, veuAtual = '', opAtual = '';

  function cor(s) {
    var k = suave(faixa(s, 1.5, 1.8));
    scene.background.lerpColors(cPlanta, cFundo, k);
    matPiso.color.lerpColors(cPisoA, cPisoB, k);
    scene.fog.color.copy(scene.background);
    var veu = (1 - k * 0.82).toFixed(2);
    if (veu !== veuAtual) { veuAtual = veu; document.documentElement.style.setProperty('--veu', veu); }
    // No celular a cena começa discreta, para o texto vir primeiro
    var op = celular ? (0.42 + 0.58 * suave(faixa(s, 0.2, 1.0))).toFixed(2) : '1';
    if (op !== opAtual) { opAtual = op; canvas.style.opacity = op; }
    matParede.opacity = matRodape.opacity = matViga.opacity = k;
    galpao.children.forEach(function (m, n) { if (n > 0) m.visible = k > 0.01; });
    grade.material.opacity = 0.16 * (1 - k);
    contorno.material.opacity = 0.9 * (1 - k);
    contorno.visible = grade.visible = k < 0.995;

    var traco = suave(faixa(s, 0, 0.8));
    plano.geometry.setDrawRange(0, Math.floor(plano.geometry.attributes.position.count * traco));
    plano.material.opacity = 0.95 * (1 - suave(faixa(s, 1.1, 1.5)));
    plano.visible = traco > 0 && s < 1.5;
    var sobeF = suave(faixa(s, 1.05, 1.42));
    fantasma.scale.y = Math.max(0.001, sobeF);
    fantasma.material.opacity = 0.6 * (1 - suave(faixa(s, 1.46, 1.9)));
    fantasma.visible = sobeF > 0 && s < 1.9;
  }

  function moveEmpilhadeira(s) {
    var k = suave(faixa(s, 5.5, 6.25));
    empilhadeira.visible = k > 0;
    empilhadeira.position.set(30 - k * 18, 0, 11.6);
  }

  var proj = new V3();
  function etiquetas(s) {
    ETIQ.forEach(function (e) {
      var o = Math.min(faixa(s, e.a, e.a + 0.08), 1 - faixa(s, e.b - 0.1, e.b));
      if (s <= 0 && e.a < 0) o = 1;
      if (o <= 0) { e.el.style.opacity = 0; return; }
      proj.copy(e.v).project(camera);
      var x = (proj.x * 0.5 + 0.5) * telaW;
      var y = (-proj.y * 0.5 + 0.5) * telaH;
      e.el.style.opacity = o;
      e.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%)';
    });
  }

  // Só um painel de texto aparece por vez, em qualquer altura de tela
  var paineis = [].slice.call(document.querySelectorAll('.painel'));
  function textos(s) {
    if (reduzir) return;
    paineis.forEach(function (p, n) {
      var ultimo = n === paineis.length - 1;
      var entra, sai;
      if (celular) {
        // No celular o painel sobe com a rolagem, desde a base da tela, e para no alto
        entra = 1;
        sai = ultimo ? 0 : faixa(s, n + 0.4, n + 0.6);
      } else {
        entra = n === 0 ? 1 : faixa(s, n - 0.46, n - 0.2);
        sai = ultimo ? 0 : faixa(s, n + 0.38, n + 0.52);
      }
      var o = Math.min(entra, 1 - sai);
      p.style.opacity = o;
      p.style.visibility = o > 0 ? 'visible' : 'hidden';
      p.style.transform = celular ? 'none' : 'translateY(' + ((1 - entra) * 26 - sai * 20).toFixed(1) + 'px)';
    });
  }

  function desenha(s) {
    Object.keys(L).forEach(function (k) { anima(L[k], s); });
    cor(s);
    moveEmpilhadeira(s);
    cameraEm(s);
    camera.updateMatrixWorld();
    etiquetas(s);
    textos(s);
    renderer.render(scene, camera);
  }

  function medeTela() {
    telaW = innerWidth;
    telaH = canvas.clientHeight;
    celular = telaW < 860;
    var aspecto = telaW / telaH;
    renderer.setSize(telaW, telaH, false);
    camera.aspect = aspecto;
    zoomTela = aspecto < 1.25 ? Math.min(1.25 / aspecto, 2.05) : 1;
    camera.updateProjectionMatrix();
    var passos = obra.querySelectorAll('.passo');
    passoH = passos[0].offsetHeight;
    sMax = (obra.offsetHeight - innerHeight) / passoH;
  }

  // Rolagem
  var alvo = 0, atual = 0, ultimo = -1, forcar = true;
  var regua = document.querySelector('.regua');
  var marcas = [].slice.call(regua.querySelectorAll('a'));

  function atualizaRegua(s) {
    regua.classList.toggle('visivel', s > 0.45 && s < 5.75);
    regua.classList.toggle('na-planta', s < 1.5);
    marcas.forEach(function (a) {
      a.classList.toggle('ativo', Math.abs(s - Number(a.dataset.passo)) < 0.5);
    });
  }

  medeTela();
  gsap.registerPlugin(ScrollTrigger);
  // As entradas de texto seguem o relógio real, mesmo em aparelho lento
  gsap.ticker.lagSmoothing(0);

  // Depois da cena, o cabeçalho ganha fundo para não cobrir os títulos
  var topo = document.querySelector('.topo');
  function cabecalho() { topo.classList.toggle('solido', obra.getBoundingClientRect().bottom < 90); }
  addEventListener('scroll', cabecalho, { passive: true });
  cabecalho();

  if (reduzir) {
    document.body.classList.add('calmo');
    alvo = atual = sMax;
    desenha(sMax);
  } else {
    ScrollTrigger.create({
      trigger: obra, start: 'top top', end: 'bottom bottom',
      onUpdate: function (st) { alvo = st.progress * sMax; atualizaRegua(alvo); },
      onRefresh: function (st) { alvo = st.progress * sMax; forcar = true; }
    });

    // Na abertura, a planta é desenhada sozinha: a primeira tela já mostra o projeto nascendo
    var intro = { v: 0 };
    if (!celular) gsap.to(intro, { v: 0.3, duration: 2.4, delay: 0.5, ease: 'power2.out' });

    // O próximo quadro é agendado antes de desenhar: um erro isolado não pode parar a cena
    var quadro = function () {
      requestAnimationFrame(quadro);
      var meta = Math.max(alvo, intro.v);
      atual += (meta - atual) * 0.14;
      if (Math.abs(meta - atual) < 0.0004) atual = meta;
      var noTrecho = obra.getBoundingClientRect().bottom > -50;
      if (noTrecho && (atual !== ultimo || forcar)) {
        try {
          desenha(atual);
          ultimo = atual;
          forcar = false;
        } catch (e) { forcar = true; }
      }
    };
    requestAnimationFrame(quadro);

    // Celular libera a memória da placa de vídeo em segundo plano: a cena precisa voltar sozinha
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); });
    canvas.addEventListener('webglcontextrestored', function () { forcar = true; });
    document.addEventListener('visibilitychange', function () { forcar = true; });
    addEventListener('pageshow', function () { forcar = true; ScrollTrigger.refresh(); });

    document.querySelectorAll('.bloco .miolo').forEach(function (m) {
      gsap.from(m.children, {
        y: 26, opacity: 0, duration: 0.55, stagger: 0.08, ease: 'power2.out',
        scrollTrigger: { trigger: m, start: 'top 82%', once: true }
      });
    });
  }

  // A barra de endereço do celular muda a altura da janela a cada rolagem.
  // Só a mudança de largura, ou de altura grande, refaz as medidas.
  var larguraAnt = innerWidth, alturaAnt = innerHeight, adiar = 0;
  addEventListener('resize', function () {
    var soBarra = innerWidth === larguraAnt && Math.abs(innerHeight - alturaAnt) < 160;
    if (celular && soBarra) return;
    clearTimeout(adiar);
    adiar = setTimeout(function () {
      larguraAnt = innerWidth; alturaAnt = innerHeight;
      medeTela();
      forcar = true;
      if (reduzir) desenha(sMax);
      ScrollTrigger.refresh();
    }, 150);
  });
})();
