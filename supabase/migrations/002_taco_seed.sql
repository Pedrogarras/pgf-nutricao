-- =====================================================
-- TACO — Tabela Brasileira de Composição de Alimentos
-- Valores por 100g / 100ml do alimento
-- Execute APÓS 001_schema.sql
-- =====================================================

insert into foods (name, kcal, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, portion_g, portion_description, food_group, source)
values

-- ========================
-- CEREAIS E DERIVADOS
-- ========================
('Arroz branco polido cozido',        128, 2.5,  28.1,  0.2,  1.6,   0,  100, '4 col. de sopa (100g)',    'Cereais e derivados', 'TACO'),
('Arroz integral cozido',             124, 2.6,  25.8,  1.0,  2.7,   0,  100, '4 col. de sopa (100g)',    'Cereais e derivados', 'TACO'),
('Aveia em flocos',                   394, 13.9, 66.6,  8.5,  9.1,   4,  100, '4 col. de sopa (40g)',     'Cereais e derivados', 'TACO'),
('Cuscuz de milho cozido',            112, 2.0,  23.8,  0.5,  1.4,   2,  100, '1 fatia média (100g)',     'Cereais e derivados', 'TACO'),
('Farinha de trigo',                  360, 9.8,  75.1,  1.4,  2.3,   2,  100, '1 xícara chá (130g)',      'Cereais e derivados', 'TACO'),
('Farinha de milho',                  361, 7.7,  78.1,  1.3,  3.6,   2,  100, '1 xícara chá (130g)',      'Cereais e derivados', 'TACO'),
('Granola',                           394, 9.2,  65.5,  12.1, 7.9,  10,  100, '4 col. de sopa (50g)',     'Cereais e derivados', 'TACO'),
('Inhame cozido',                     116, 1.5,  27.7,  0.2,  3.1,  14,  100, '1 pedaço médio (80g)',     'Cereais e derivados', 'TACO'),
('Macarrão cozido',                   149, 4.9,  30.6,  0.9,  1.8,   1,  100, '1 escumadeira (100g)',     'Cereais e derivados', 'TACO'),
('Mandioca cozida',                   120, 0.6,  28.9,  0.2,  2.0,  10,  100, '1 pedaço médio (100g)',    'Cereais e derivados', 'TACO'),
('Mandioquinha cozida',                90, 2.0,  19.7,  0.2,  3.0,  18,  100, '1 pedaço médio (100g)',    'Cereais e derivados', 'TACO'),
('Milho verde cozido',                100, 3.2,  22.1,  1.2,  3.2,   1,  100, '1 espiga pequena (100g)', 'Cereais e derivados', 'TACO'),
('Pão de forma integral',             253, 8.9,  44.5,  4.8,  5.7, 395,  100, '2 fatias (50g)',           'Cereais e derivados', 'TACO'),
('Pão de forma tradicional',          264, 7.6,  50.4,  4.1,  2.3, 495,  100, '2 fatias (50g)',           'Cereais e derivados', 'TACO'),
('Pão francês',                       300, 8.0,  58.6,  3.1,  2.3, 535,  100, '1 unidade (50g)',          'Cereais e derivados', 'TACO'),
('Pão de queijo',                     281, 4.0,  41.6,  11.0, 0.6, 282,  100, '2 unidades médias (60g)', 'Cereais e derivados', 'TACO'),
('Quinoa cozida',                     120, 4.4,  21.3,  1.9,  2.8,   5,  100, '4 col. de sopa (100g)',   'Cereais e derivados', 'TACO'),
('Tapioca (goma)',                    336, 0.3,  83.9,  0.0,  0.2,   2,  100, '1 unidade (50g)',          'Cereais e derivados', 'TACO'),
('Batata inglesa cozida',              52, 1.2,  11.9,  0.1,  1.4,   2,  100, '1 unidade média (100g)',  'Cereais e derivados', 'TACO'),
('Batata doce cozida',                 77, 0.7,  18.4,  0.1,  2.2,  36,  100, '1 unidade média (100g)',  'Cereais e derivados', 'TACO'),

-- ========================
-- CARNES BOVINAS
-- ========================
('Alcatra cozida',                    247, 29.3, 0.0,  13.8,  0,  61, 100, '1 bife médio (100g)',   'Carnes bovinas', 'TACO'),
('Carne moída refogada',              258, 27.4, 0.0,  16.0,  0,  73, 100, '4 col. de sopa (100g)', 'Carnes bovinas', 'TACO'),
('Contrafilé grelhado',               287, 27.0, 0.0,  19.5,  0,  63, 100, '1 bife médio (100g)',   'Carnes bovinas', 'TACO'),
('Coxão mole cozido',                 260, 28.4, 0.0,  15.9,  0,  59, 100, '1 porção (100g)',       'Carnes bovinas', 'TACO'),
('Filé mignon grelhado',              248, 30.8, 0.0,  13.3,  0,  56, 100, '1 medalhão (100g)',     'Carnes bovinas', 'TACO'),
('Músculo cozido',                    218, 30.5, 0.0,   9.8,  0,  67, 100, '1 porção (100g)',       'Carnes bovinas', 'TACO'),
('Patinho cozido',                    219, 28.6, 0.0,  10.7,  0,  61, 100, '1 bife médio (100g)',   'Carnes bovinas', 'TACO'),
('Picanha grelhada',                  304, 25.4, 0.0,  21.9,  0,  57, 100, '1 fatia (100g)',        'Carnes bovinas', 'TACO'),

-- ========================
-- AVES
-- ========================
('Frango inteiro assado',             181, 27.5, 0.0,   7.5,  0,  79, 100, '1 porção (100g)',        'Aves', 'TACO'),
('Coxa de frango assada',             238, 25.4, 0.0,  14.9,  0,  87, 100, '1 coxa média (100g)',    'Aves', 'TACO'),
('Peito de frango grelhado',          163, 31.5, 0.0,   3.2,  0,  72, 100, '1 filé médio (100g)',    'Aves', 'TACO'),
('Peru peito assado',                 159, 28.5, 0.0,   4.7,  0,  57, 100, '1 fatia grande (100g)', 'Aves', 'TACO'),
('Sobrecoxa de frango assada',        261, 23.4, 0.0,  17.9,  0,  88, 100, '1 sobrecoxa (100g)',     'Aves', 'TACO'),

-- ========================
-- PESCADOS E FRUTOS DO MAR
-- ========================
('Atum em lata (em água)',            127, 28.0, 0.0,   1.7,  0, 305, 100, '1/2 lata (100g)',        'Pescados', 'TACO'),
('Bacalhau dessalgado cozido',        138, 30.5, 0.0,   1.3,  0, 180, 100, '1 porção (100g)',        'Pescados', 'TACO'),
('Camarão cozido',                     98, 20.3, 0.9,   1.4,  0, 190, 100, '1 porção (100g)',        'Pescados', 'TACO'),
('Merluza cozida',                    103, 21.0, 0.0,   1.9,  0,  81, 100, '1 filé médio (100g)',    'Pescados', 'TACO'),
('Salmão grelhado',                   216, 19.9, 0.0,  14.7,  0,  56, 100, '1 filé médio (100g)',    'Pescados', 'TACO'),
('Sardinha em lata (em óleo)',        252, 22.7, 0.0,  17.5,  0, 400, 100, '1 lata (100g)',          'Pescados', 'TACO'),
('Tilápia assada',                     96, 20.1, 0.0,   1.7,  0,  48, 100, '1 filé médio (100g)',    'Pescados', 'TACO'),

-- ========================
-- OVOS
-- ========================
('Clara de ovo cozida',                50, 10.8, 0.8,   0.1,  0, 133, 100, '3 claras (100g)',    'Ovos', 'TACO'),
('Gema de ovo',                       330, 15.9, 1.2,  28.1,  0,  48, 100, '3 gemas (60g)',      'Ovos', 'TACO'),
('Ovo de galinha cozido',             146, 13.0, 0.6,   9.8,  0, 123, 100, '2 ovos médios (100g)','Ovos', 'TACO'),
('Ovo de galinha mexido',             157, 11.6, 1.2,  11.7,  0, 150, 100, '2 ovos médios (100g)','Ovos', 'TACO'),

-- ========================
-- LEITE E DERIVADOS
-- ========================
('Creme de leite',                    239, 2.8,  3.5,  23.7,  0,  36, 100, '2 col. de sopa (30ml)',   'Laticínios', 'TACO'),
('Iogurte desnatado',                  43, 4.0,  6.1,   0.2,  0,  54, 100, '1 pote (170g)',            'Laticínios', 'TACO'),
('Iogurte grego natural',             100, 10.0, 5.0,   3.5,  0,  35, 100, '1 pote (170g)',            'Laticínios', 'TACO'),
('Iogurte natural integral',           66, 3.6,  4.9,   3.3,  0,  51, 100, '1 pote (170g)',            'Laticínios', 'TACO'),
('Leite desnatado',                    35, 3.4,  4.9,   0.1,  0,  50, 100, '1 copo (200ml)',           'Laticínios', 'TACO'),
('Leite integral',                     61, 3.2,  4.8,   3.2,  0,  47, 100, '1 copo (200ml)',           'Laticínios', 'TACO'),
('Leite semidesnatado',                47, 3.3,  4.8,   1.6,  0,  49, 100, '1 copo (200ml)',           'Laticínios', 'TACO'),
('Queijo coalho',                     343, 24.2, 1.4,  26.5,  0, 580, 100, '1 fatia média (30g)',      'Laticínios', 'TACO'),
('Queijo cottage',                     97, 12.5, 3.5,   3.8,  0, 300, 100, '2 col. de sopa (50g)',     'Laticínios', 'TACO'),
('Queijo mussarela',                  335, 23.0, 2.1,  25.5,  0, 596, 100, '2 fatias médias (30g)',    'Laticínios', 'TACO'),
('Queijo prato',                      370, 22.3, 1.5,  30.7,  0, 626, 100, '2 fatias médias (30g)',    'Laticínios', 'TACO'),
('Requeijão cremoso',                 236, 7.7,  3.0,  21.8,  0, 400, 100, '1 col. de sopa (15g)',     'Laticínios', 'TACO'),

-- ========================
-- LEGUMINOSAS
-- ========================
('Ervilha cozida',                     71, 5.1,  11.1,  0.3, 7.2,   1, 100, '3 col. de sopa (75g)',  'Leguminosas', 'TACO'),
('Feijão carioca cozido',              76, 4.8,  13.6,  0.5, 8.4,   2, 100, '1 concha (86g)',         'Leguminosas', 'TACO'),
('Feijão preto cozido',                77, 4.5,  14.0,  0.5, 8.4,   2, 100, '1 concha (86g)',         'Leguminosas', 'TACO'),
('Grão-de-bico cozido',               164, 8.9,  27.4,  2.6, 7.6,   7, 100, '3 col. de sopa (75g)',  'Leguminosas', 'TACO'),
('Lentilha cozida',                    93, 6.3,  16.3,  0.5, 5.4,   2, 100, '3 col. de sopa (75g)',  'Leguminosas', 'TACO'),
('Proteína de soja texturizada cozida',329, 51.5, 29.8,  1.8,13.5,  10, 100, '4 col. de sopa (50g)', 'Leguminosas', 'TACO'),
('Soja cozida',                       141, 14.0, 11.5,  5.0, 9.6,   1, 100, '3 col. de sopa (75g)',  'Leguminosas', 'TACO'),
('Tofu',                               76, 8.1,   1.9,  4.2, 0.3,   7, 100, '2 fatias (100g)',        'Leguminosas', 'TACO'),

-- ========================
-- VERDURAS E HORTALIÇAS
-- ========================
('Abóbora cozida',                     26, 0.8,   6.0,  0.1, 1.0,   1, 100, '2 col. de sopa (80g)',  'Verduras e hortaliças', 'TACO'),
('Abobrinha cozida',                   15, 0.8,   2.8,  0.2, 1.0,   1, 100, '2 col. de sopa (80g)',  'Verduras e hortaliças', 'TACO'),
('Alface crespa crua',                 11, 1.3,   1.7,  0.2, 1.8,  10, 100, '4 folhas (30g)',         'Verduras e hortaliças', 'TACO'),
('Alho',                              150, 6.4,  32.6,  0.5, 2.1,   6, 100, '3 dentes (10g)',         'Verduras e hortaliças', 'TACO'),
('Berinjela cozida',                   23, 0.7,   5.5,  0.1, 2.6,   2, 100, '3 col. de sopa (80g)',  'Verduras e hortaliças', 'TACO'),
('Beterraba cozida',                   39, 1.7,   8.4,  0.1, 2.9,  48, 100, '3 fatias médias (80g)', 'Verduras e hortaliças', 'TACO'),
('Brócolis cozido',                    35, 3.7,   3.7,  0.3, 3.2,  25, 100, '1/2 xícara (70g)',       'Verduras e hortaliças', 'TACO'),
('Cenoura crua',                       34, 1.3,   7.7,  0.3, 3.2,  77, 100, '1 unidade média (60g)', 'Verduras e hortaliças', 'TACO'),
('Chuchu cozido',                      19, 0.5,   4.5,  0.1, 1.8,   1, 100, '3 col. de sopa (80g)',  'Verduras e hortaliças', 'TACO'),
('Couve manteiga refogada',            64, 3.8,   6.8,  2.5, 4.5,  18, 100, '2 col. de sopa (40g)',  'Verduras e hortaliças', 'TACO'),
('Couve-flor cozida',                  28, 2.4,   4.5,  0.2, 2.3,  15, 100, '4 buquês (80g)',         'Verduras e hortaliças', 'TACO'),
('Espinafre cozido',                   22, 3.0,   2.4,  0.5, 2.9,  93, 100, '2 col. de sopa (40g)',  'Verduras e hortaliças', 'TACO'),
('Cebola crua',                        40, 1.8,   8.6,  0.2, 2.3,   3, 100, '1 unidade média (80g)', 'Verduras e hortaliças', 'TACO'),
('Pepino',                             10, 0.7,   2.1,  0.0, 0.5,   2, 100, '5 fatias médias (80g)', 'Verduras e hortaliças', 'TACO'),
('Pimentão verde',                     20, 0.9,   4.4,  0.1, 2.0,   2, 100, '1/2 unidade (50g)',      'Verduras e hortaliças', 'TACO'),
('Repolho cru',                        17, 1.4,   3.6,  0.1, 2.5,  13, 100, '4 col. de sopa (60g)',  'Verduras e hortaliças', 'TACO'),
('Tomate',                             15, 1.0,   3.1,  0.1, 1.3,   3, 100, '1 unidade média (100g)','Verduras e hortaliças', 'TACO'),
('Vagem cozida',                       27, 1.8,   5.2,  0.2, 2.3,   2, 100, '4 col. de sopa (80g)',  'Verduras e hortaliças', 'TACO'),

-- ========================
-- FRUTAS
-- ========================
('Abacate',                            96, 1.2,   6.0,  8.4, 6.3,   3, 100, '1/4 unidade (50g)',      'Frutas', 'TACO'),
('Abacaxi',                            48, 0.9,  12.3,  0.1, 1.0,   1, 100, '1 fatia média (80g)',    'Frutas', 'TACO'),
('Banana nanica',                       87, 1.4,  22.3,  0.1, 2.0,   2, 100, '1 unidade pequena (80g)','Frutas', 'TACO'),
('Banana prata',                        92, 1.3,  23.8,  0.1, 2.0,   2, 100, '1 unidade média (90g)', 'Frutas', 'TACO'),
('Coco seco',                          354, 3.4,  15.2, 33.5, 9.0,  17, 100, '2 col. de sopa (30g)',  'Frutas', 'TACO'),
('Goiaba',                              54, 2.3,  12.0,  0.3, 6.3,   5, 100, '1 unidade média (100g)','Frutas', 'TACO'),
('Laranja pera',                        46, 0.9,  11.5,  0.1, 2.3,   1, 100, '1 unidade média (130g)','Frutas', 'TACO'),
('Limão',                               32, 1.0,   7.9,  0.2, 1.3,   1, 100, '1 unidade média (60g)', 'Frutas', 'TACO'),
('Maçã fuji',                           56, 0.3,  14.9,  0.2, 2.0,   1, 100, '1 unidade média (130g)','Frutas', 'TACO'),
('Mamão formosa',                       45, 0.5,  11.8,  0.1, 1.8,   6, 100, '1 fatia média (100g)',  'Frutas', 'TACO'),
('Manga palmer',                        64, 0.4,  17.0,  0.2, 1.6,   2, 100, '1 fatia grande (100g)', 'Frutas', 'TACO'),
('Melancia',                            33, 0.6,   8.1,  0.2, 0.3,   1, 100, '1 fatia média (200g)',  'Frutas', 'TACO'),
('Melão',                               29, 0.9,   7.0,  0.1, 0.3,  11, 100, '1 fatia média (130g)',  'Frutas', 'TACO'),
('Morango',                             30, 0.8,   7.1,  0.3, 2.0,   1, 100, '10 unidades (100g)',    'Frutas', 'TACO'),
('Pera',                                55, 0.6,  14.3,  0.1, 3.1,   1, 100, '1 unidade média (130g)','Frutas', 'TACO'),
('Pêssego',                             35, 0.9,   8.2,  0.1, 2.0,   1, 100, '1 unidade média (100g)','Frutas', 'TACO'),
('Uva',                                 69, 0.7,  17.9,  0.2, 1.0,   2, 100, '15 uvas (100g)',        'Frutas', 'TACO'),

-- ========================
-- GORDURAS E ÓLEOS
-- ========================
('Azeite de oliva extra virgem',       884, 0.0,  0.0, 100.0, 0,   0, 100, '1 col. de sopa (13ml)',  'Gorduras e óleos', 'TACO'),
('Manteiga',                           726, 0.5,  0.1,  83.2, 0,  621, 100, '1 col. de chá (5g)',    'Gorduras e óleos', 'TACO'),
('Margarina cremosa',                  563, 0.7,  1.4,  60.4, 0,  470, 100, '1 col. de chá (5g)',    'Gorduras e óleos', 'TACO'),
('Óleo de coco',                       884, 0.0,  0.0,  99.1, 0,    0, 100, '1 col. de sopa (13ml)', 'Gorduras e óleos', 'TACO'),
('Óleo de soja',                       884, 0.0,  0.0, 100.0, 0,    0, 100, '1 col. de sopa (13ml)', 'Gorduras e óleos', 'TACO'),

-- ========================
-- AÇÚCARES E ADOÇANTES
-- ========================
('Açúcar refinado',                    387, 0.0,  99.6,  0.0, 0,    1, 100, '1 col. de chá (5g)',    'Açúcares', 'TACO'),
('Açúcar mascavo',                     375, 0.5,  96.1,  0.2, 0,    2, 100, '1 col. de chá (5g)',    'Açúcares', 'TACO'),
('Mel',                                309, 0.4,  84.5,  0.0, 0.2,  4, 100, '1 col. de sopa (20g)',  'Açúcares', 'TACO'),

-- ========================
-- OLEAGINOSAS
-- ========================
('Amendoim torrado sem sal',           581, 26.0, 20.7,  47.5, 8.0,  2, 100, '1 punhado (30g)',       'Oleaginosas', 'TACO'),
('Castanha do Pará',                   656, 14.5, 12.3,  63.5, 7.5,  3, 100, '2 unidades (10g)',      'Oleaginosas', 'TACO'),
('Castanha de caju torrada',           570, 18.5, 29.1,  46.3, 3.7, 12, 100, '1 punhado (30g)',       'Oleaginosas', 'TACO'),
('Amêndoa',                            581, 21.2, 21.7,  48.8, 12.5, 1, 100, '1 punhado (30g)',       'Oleaginosas', 'TACO'),
('Nozes',                              620, 14.3, 14.1,  59.4, 6.7,  1, 100, '4 metades (25g)',       'Oleaginosas', 'TACO'),

-- ========================
-- BEBIDAS
-- ========================
('Água de coco',                        22, 0.3,   5.3,  0.2, 0.2,  45, 100, '1 copo (200ml)',        'Bebidas', 'TACO'),
('Café sem açúcar',                      5, 0.4,   0.8,  0.0, 0.0,   2, 100, '1 xícara (50ml)',       'Bebidas', 'TACO'),
('Chá verde sem açúcar',                 1, 0.0,   0.3,  0.0, 0.0,   1, 100, '1 xícara (200ml)',      'Bebidas', 'TACO'),
('Suco de laranja natural',             45, 0.7,  10.9,  0.2, 0.3,   1, 100, '1 copo (200ml)',        'Bebidas', 'TACO'),
('Leite de coco',                      196, 2.0,   4.5,  19.6, 0.0, 13, 100, '3 col. de sopa (50ml)','Bebidas', 'TACO'),

-- ========================
-- SUPLEMENTOS (valores aproximados)
-- ========================
('Whey protein concentrado 80%',       400, 75.0, 10.0,   5.0, 0.0, 100, 100, '1 scoop (30g)',        'Suplementos', 'TACO'),
('Whey protein isolado 90%',           380, 85.0,  4.0,   2.0, 0.0, 100, 100, '1 scoop (30g)',        'Suplementos', 'TACO'),
('Caseína proteína',                   380, 80.0,  5.0,   2.0, 0.0, 130, 100, '1 scoop (30g)',        'Suplementos', 'TACO'),
('Creatina monohidratada',               0, 0.0,   0.0,   0.0, 0.0,   0, 100, '1 col. de chá (5g)',   'Suplementos', 'TACO'),
('BCAA em pó',                         400, 98.0,  0.0,   1.0, 0.0,  10, 100, '1 col. de chá (5g)',   'Suplementos', 'TACO'),
('Albumina em pó',                     381, 86.0,  3.0,   1.0, 0.0, 400, 100, '3 col. de sopa (30g)', 'Suplementos', 'TACO'),

-- ========================
-- EMBUTIDOS E FRIOS
-- ========================
('Linguiça calabresa cozida',          297, 16.0,  1.0,  25.6, 0.0, 890, 100, '2 rodelas (50g)',      'Embutidos', 'TACO'),
('Peito de peru defumado',             109, 18.8,  1.9,   3.0, 0.0, 923, 100, '2 fatias (30g)',       'Embutidos', 'TACO'),
('Presunto',                           147, 20.8,  1.5,   6.5, 0.0, 910, 100, '2 fatias (30g)',       'Embutidos', 'TACO'),

-- ========================
-- OUTROS COMUNS
-- ========================
('Azeite de dendê',                    884, 0.0,   0.0, 100.0, 0.0,  0, 100, '1 col. de sopa (13ml)','Gorduras e óleos', 'TACO'),
('Biomassa de banana verde',            96, 1.8,  21.9,  0.3,  4.9,  3, 100, '2 col. de sopa (40g)', 'Outros', 'TACO'),
('Frango desfiado cozido',             148, 28.0,  0.0,   3.8, 0.0, 68, 100, '4 col. de sopa (100g)','Aves', 'TACO'),
('Linguiça frango grelhada',           210, 18.0,  1.5,  14.5, 0.0,680, 100, '1 gomo (70g)',         'Aves', 'TACO'),
('Omelete simples',                    155, 11.0,  1.5,  11.5, 0.0,170, 100, '1 unidade (120g)',     'Ovos', 'TACO')

on conflict do nothing;

-- =====================================================
-- Índice de texto para busca rápida
-- =====================================================
create index if not exists foods_name_trgm_idx
  on foods using gin (name gin_trgm_ops);
