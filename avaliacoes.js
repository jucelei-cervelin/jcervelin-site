(function () {
  'use strict';

  // Retrato do perfil no Google em 30/10/2026. Com a função /api/avaliacoes ligada,
  // a nota, o total e os cartões passam a vir direto do Google.
  var RETRATO = {
    nota: 5,
    total: 28,
    fonte: 'Consultado em 30/10/2026',
    itens: [
      { nome: 'Elisandra Ferreira', sub: '4 avaliações', nota: 5, quando: 'um ano atrás', texto: 'Recomendo a empresa e principalmente o Jucelei, como um vendedor excepcional. Pois, profissionalismo e dedicação definem seu trabalho!' },
      { nome: 'FK Advogados', sub: '6 avaliações', nota: 5, quando: 'um ano atrás', texto: 'Empresa seria, cumpre prazos e metas, o sócio Jucelei é um grande profissional.' },
      { nome: 'Edmilson Torres', sub: 'Local Guide · 21 avaliações', nota: 5, quando: 'um ano atrás', texto: 'Excelência no atendimento, postura profissional de grande valia. Produtos de qualidade. Super recomendo' },
      { nome: 'Arno Didek', sub: '2 avaliações', nota: 5, quando: 'um ano atrás', texto: 'Sem dúvida é melhor ! Atendimento nota 1000 . Produtos de altíssima qualidade. Recomendo fortemente .' },
      { nome: 'Adon Contabilidade', sub: 'Local Guide · 21 avaliações', nota: 5, quando: 'um ano atrás', texto: 'Confiança, respeito e profissionalismo. Estas são algumas das virtudes. Parabéns pelo belo trabalho.' },
      { nome: 'Schirlei Vidal', sub: 'Local Guide · 31 avaliações', nota: 5, quando: 'um ano atrás', texto: 'Super recomendo! Atendimento diferenciado, excelente profissional!' },
      { nome: 'Ed Carlos Pedroso', sub: '5 avaliações', nota: 5, quando: 'um ano atrás', texto: 'Recomendo, muita experiência, competência e excelência. 👏🏻👏🏻👏🏻' },
      { nome: 'Paulo Coelho', sub: 'Local Guide · 25 avaliações', nota: 5, quando: 'um ano atrás', texto: 'Excelente. Super recomendo.' },
      { nome: 'MRS Negócios Imobiliários', sub: '1 avaliação', nota: 5, quando: 'um ano atrás', texto: 'Recomendo. Excelente profissional!' }
    ]
  };

  var trilho = document.getElementById('trilho');

  function texto(tag, classe, conteudo) {
    var el = document.createElement(tag);
    el.className = classe;
    el.textContent = conteudo;
    return el;
  }

  function corDoNome(nome) {
    var soma = 0;
    for (var i = 0; i < nome.length; i++) soma += nome.charCodeAt(i);
    return 'hsl(' + (190 + soma % 40) + ', 48%, ' + (30 + soma % 14) + '%)';
  }

  function estrelas(nota) {
    var cheias = Math.round(nota);
    return '★★★★★'.slice(0, cheias) + '☆☆☆☆☆'.slice(0, 5 - cheias);
  }

  function cartao(a) {
    var c = document.createElement('article');
    c.className = 'avaliacao';

    var topo = document.createElement('div');
    topo.className = 'avaliacao-topo';
    var foto;
    if (a.foto) {
      foto = document.createElement('img');
      foto.className = 'avaliacao-foto';
      foto.src = a.foto;
      foto.alt = '';
      foto.loading = 'lazy';
      foto.referrerPolicy = 'no-referrer';
    } else {
      foto = texto('div', 'avaliacao-foto', a.nome.charAt(0).toUpperCase());
      foto.style.background = corDoNome(a.nome);
    }
    var quem = document.createElement('div');
    quem.appendChild(texto('div', 'avaliacao-nome', a.nome));
    if (a.sub) quem.appendChild(texto('div', 'avaliacao-sub', a.sub));
    topo.appendChild(foto);
    topo.appendChild(quem);

    var nota = document.createElement('div');
    nota.className = 'avaliacao-nota';
    nota.appendChild(texto('span', 'estrelas', estrelas(a.nota)));
    nota.appendChild(document.createTextNode(a.quando || ''));

    c.appendChild(topo);
    c.appendChild(nota);
    c.appendChild(texto('p', '', a.texto));
    return c;
  }

  function monta(d) {
    var nota = Number(d.nota).toFixed(1).replace('.', ',');
    document.querySelector('[data-nota]').textContent = nota;
    document.querySelector('[data-total]').textContent = d.total + ' avaliações';
    document.querySelector('[data-fonte]').textContent = d.fonte;
    document.querySelector('.nota-geral .estrelas').setAttribute('aria-label', 'Nota ' + nota + ' de 5 estrelas');

    // Metade do trilho precisa cobrir telas largas; a segunda metade fecha o laço
    var base = d.itens.slice();
    while (base.length < 10) base = base.concat(d.itens);
    trilho.textContent = '';
    base.concat(base).forEach(function (a, i) {
      var c = cartao(a);
      if (i >= base.length) c.setAttribute('aria-hidden', 'true');
      trilho.appendChild(c);
    });
    trilho.style.setProperty('--duracao', base.length * 7 + 's');
  }

  monta(RETRATO);

  // Só existe com o site publicado na Cloudflare e a chave do Google configurada
  if (/^https?:$/.test(location.protocol)) {
    fetch('/api/avaliacoes')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && d.itens && d.itens.length) monta(d); })
      .catch(function () {});
  }
})();
