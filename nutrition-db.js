const NutritionDB = {
    meals: {
        breakfast: [
            {
                name: "Ovos e Pão Integral",
                foods: ["2-3 Ovos mexidos", "2 Fatias de pão integral", "1 Fruta (Maçã ou Banana)"],
                macros: { p: 20, c: 35, f: 15 },
                prefs: ["omnivore", "low-carb"]
            },
            {
                name: "Tapioca com Frango",
                foods: ["Tapioca (3 cda)", "Frango desfiado (80g)", "Suco de laranja"],
                macros: { p: 25, c: 45, f: 5 },
                prefs: ["omnivore"]
            },
            {
                name: "Iogurte com Granola",
                foods: ["Iogurte natural (170g)", "Granola (30g)", "Mel (1 cda)"],
                macros: { p: 15, c: 40, f: 8 },
                prefs: ["vegetarian"]
            },
            {
                name: "Mingau de Aveia Vegan",
                foods: ["Aveia em flocos (40g)", "Leite de amêndoas", "Pasta de amendoim (1 cda)"],
                macros: { p: 12, c: 45, f: 12 },
                prefs: ["vegan", "vegetarian"]
            },
            {
                name: "Crepioca de Queijo",
                foods: ["1 Ovo + 2 cda Goma de Tapioca", "Queijo Minas (2 fatias)", "Café sem açúcar"],
                macros: { p: 18, c: 25, f: 12 },
                prefs: ["omnivore", "vegetarian"]
            },
            {
                name: "Abacate com Ovos (Low Carb)",
                foods: ["1/2 Abacate médio", "2 Ovos cozidos", "Sementes de girassol"],
                macros: { p: 16, c: 8, f: 26 },
                prefs: ["omnivore", "vegetarian", "low-carb", "ketogenic"]
            }
        ],
        lunch: [
            {
                name: "Frango com Batata Doce",
                foods: ["Frango grelhado (120-150g)", "Batata doce cozida (150g)", "Salada verde à vontade"],
                macros: { p: 35, c: 40, f: 5 },
                prefs: ["omnivore"]
            },
            {
                name: "Peixe com Arroz e Legumes",
                foods: ["Filé de peixe (150g)", "Arroz integral (100g)", "Brócolis e Cenoura"],
                macros: { p: 30, c: 35, f: 8 },
                prefs: ["omnivore"]
            },
            {
                name: "Bowl de Grão de Bico",
                foods: ["Grão de bico cozido (150g)", "Quinoa (80g)", "Abacate (1/4)"],
                macros: { p: 18, c: 50, f: 15 },
                prefs: ["vegan", "vegetarian"]
            },
            {
                name: "Carne Moída com Mandioca",
                foods: ["Patinho moído (130g)", "Mandioca cozida (120g)", "Feijão (1 concha)"],
                macros: { p: 32, c: 45, f: 10 },
                prefs: ["omnivore"]
            },
            {
                name: "Macarrão Integral com Atum",
                foods: ["Macarrão integral (80g cru)", "1 lata de Atum em água", "Molho de tomate natural"],
                macros: { p: 34, c: 55, f: 6 },
                prefs: ["omnivore"]
            },
            {
                name: "Tofu Estufado com Arroz de Couve-Flor",
                foods: ["Tofu (150g)", "Arroz de couve-flor (200g)", "Castanhas trituradas"],
                macros: { p: 20, c: 10, f: 18 },
                prefs: ["vegan", "vegetarian", "low-carb", "ketogenic"]
            }
        ],
        snack: [
            {
                name: "Mix de Oleaginosas",
                foods: ["3 nozes", "5 amêndoas", "1 Fruta"],
                macros: { p: 5, c: 20, f: 12 },
                prefs: ["omnivore", "vegan", "vegetarian", "low-carb"]
            },
            {
                name: "Shake de Proteína",
                foods: ["Whey Protein (30g) ou Proteína Vegan", "Água ou Leite vegetal"],
                macros: { p: 25, c: 5, f: 2 },
                prefs: ["omnivore", "vegetarian", "low-carb"]
            },
            {
                name: "Pão com Pasta de Amendoim",
                foods: ["1 Fatia de pão integral", "1 cda Pasta de amendoim"],
                macros: { p: 8, c: 18, f: 10 },
                prefs: ["omnivore", "vegan", "vegetarian"]
            },
            {
                name: "Omelete Simples",
                foods: ["2 Ovos", "Temperos naturais"],
                macros: { p: 14, c: 2, f: 10 },
                prefs: ["omnivore", "vegetarian", "low-carb", "ketogenic"]
            }
        ],
        dinner: [
            {
                name: "Omelete de Legumes",
                foods: ["3 Ovos", "Espinafre, Tomate e Cebola", "Queijo branco (30g)"],
                macros: { p: 22, c: 10, f: 18 },
                prefs: ["omnivore", "vegetarian", "low-carb"]
            },
            {
                name: "Carne com Salada",
                foods: ["Patinho moído (120g)", "Salada rústica", "Azeite de oliva (1 cda)"],
                macros: { p: 32, c: 5, f: 15 },
                prefs: ["omnivore", "low-carb"]
            },
            {
                name: "Tofu Grelhado com Legumes",
                foods: ["Tofu firme (150g)", "Mix de legumes no vapor", "Gergelim"],
                macros: { p: 20, c: 15, f: 12 },
                prefs: ["vegan", "vegetarian"]
            },
            {
                name: "Sopa de Legumes com Frango",
                foods: ["Frango desfiado (100g)", "Legumes variados (abóbora, chuchu, cenoura)"],
                macros: { p: 28, c: 20, f: 8 },
                prefs: ["omnivore", "low-carb"]
            },
            {
                name: "Salmão com Aspargos",
                foods: ["Filé de salmão (150g)", "Aspargos ou Vagem grelhada"],
                macros: { p: 30, c: 5, f: 22 },
                prefs: ["omnivore", "low-carb", "ketogenic"]
            }
        ]
    }
};

window.NutritionDB = NutritionDB;
