export const AZUR = {
  pageBg:   '#070d16',
  pageGlow: 'radial-gradient(125% 120% at 50% -8%, #12243c 0%, #0c1828 46%, #060c15 100%)',
  panel:    'linear-gradient(180deg, #112135 0%, #0c1827 100%)',
  panelSolid: '#0e1b2c',
  edge:     'rgba(96,160,224,0.26)',
  edgeSoft: 'rgba(96,160,224,0.12)',
  ink:      '#eaf1fb',
  dim:      '#a6bdd6',
  faint:    '#6c8299',
  gold:     '#e8c069',
  goldDim:  '#b08f3f',
  goldGlow: 'rgba(232,192,105,0.30)',
  accent:   '#56a8e6',
  sell:     '#d6463f',
  sellInk:  '#ffd7d2',
  sellGlow: 'rgba(214,70,63,0.45)',
  buy:      '#46b06f',
  buyGlow:  'rgba(70,176,111,0.42)',
  cardBg:   'rgba(20,38,60,0.74)',
  cardEdge: 'rgba(96,160,224,0.18)',
  nodeFill: 'radial-gradient(circle at 38% 32%, #16304c, #0c1827)',
  nodeRing: 'rgba(96,160,224,0.30)',
  band:     'rgba(86,168,230,0.05)',
  hr:       'rgba(96,160,224,0.16)',
  players: {
    toi:       '#56c5d6', // Nun — bleu
    brice:     '#f2c230', // jaune (V8, était orange #e08a45)
    raph:      '#4caf66', // vert (V8, était doré #e8c069)
    julien:    '#d6463f', // rouge (V8, 4e joueur, invisible pour l'instant)
    available: '#46607d',
  },
  // Identité couleur par ressource — source unique (V8). Une ressource = une couleur,
  // partout : fond de carte teinté, courbe, titre, prix, icône, floaters.
  // La direction haussier/baissier se lit via le triangle EMA (vert/rouge), PAS via ces teintes.
  resources: {
    wood:   '#a9764e', // marron (V8, était verdâtre #5a9e6a)
    olive:  '#8bc34a', // vert olive
    meuble: '#b07ec8', // violet
    huile:  '#e0a030', // ambre (décalé du gold UI #e8c069 pour éviter la confusion)
    pierre: '#9aa7b5', // gris (hors carte pour l'instant)
  },
  font: {
    display: 'Marcellus, serif',
    body:    'Marcellus, serif',
    num:     '"Outfit", sans-serif',
  },
} as const
