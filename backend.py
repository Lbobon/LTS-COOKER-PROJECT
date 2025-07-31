from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import csv
import re
from difflib import SequenceMatcher
from collections import defaultdict
import os
import sys
import json
import hashlib
import string
from urllib.parse import quote_plus
from bs4 import BeautifulSoup

app = Flask(__name__)
CORS(app)

OLLAMA_API_URL = "http://localhost:11434/api/generate"

# Global variable to store grocery data
grocery_data = []

def load_grocery_data():
    """Load grocery data from WMT CSV file only, with robust logging."""
    global grocery_data
    grocery_data = []
    
    csv_file_path = 'WMT_Grocery_202209.csv'
    print(f"--- Attempting to load grocery data from: {os.path.abspath(csv_file_path)} ---")

    if not os.path.exists(csv_file_path):
        print(f"--- FATAL ERROR: CSV file not found at '{os.path.abspath(csv_file_path)}'")
        return

    # Increase CSV field size limit for potentially large fields
    max_int = sys.maxsize
    while True:
        try:
            csv.field_size_limit(max_int)
            break
        except OverflowError:
            max_int = int(max_int/10)

    try:
        with open(csv_file_path, 'r', encoding='utf-8') as file:
            print("--- File opened successfully. Reading headers... ---")
            csv_reader = csv.DictReader(file)
            headers = csv_reader.fieldnames
            print(f"--- CSV Headers detected: {headers} ---")

            for row in csv_reader:
                current_price = row.get('PRICE_CURRENT', '').strip()
                retail_price = row.get('PRICE_RETAIL', '').strip()
                price = current_price if current_price else retail_price
                
                if price and price.lower() not in ['nan', 'none', '']:
                    try:
                        price_value = float(price.replace('$', '').replace(',', ''))
                        formatted_price = f"${price_value:.2f}"
                    except (ValueError, AttributeError):
                        formatted_price = "Price unavailable"
                else:
                    formatted_price = "Price unavailable"
                
                promotion = row.get('PROMOTION', '').strip()
                availability = 'On Sale' if promotion and promotion.lower() not in ['none', 'nan', ''] else 'In Stock'
                
                grocery_data.append({
                    'id': row.get('SKU', ''), 'name': row.get('PRODUCT_NAME', ''),
                    'brand': row.get('BRAND', ''), 'category': row.get('CATEGORY', ''),
                    'subcategory': row.get('SUBCATEGORY', ''), 'department': row.get('DEPARTMENT', ''),
                    'product_size': row.get('PRODUCT_SIZE', ''), 'source': 'walmart',
                    'price': formatted_price, 'availability': availability,
                    'promotion': promotion if promotion and promotion.lower() not in ['none', 'nan', ''] else None,
                    'product_url': row.get('PRODUCT_URL', '')
                })
        print(f"--- Successfully loaded {len(grocery_data)} products from {csv_file_path} ---")

    except Exception as e:
        print(f"--- FATAL ERROR loading grocery data: {e} ---")
        grocery_data = []

def find_matching_products(ingredient, used_product_ids=None, top_n=3):
    """Find matching products for an ingredient using a robust scoring model that prevents false matches."""
    if not grocery_data:
        return []
    
    if used_product_ids is None:
        used_product_ids = set()

    ingredient_clean = re.sub(r'[^\w\s]', '', ingredient.lower().strip())
    ingredient_words = set(ingredient_clean.split())
    
    # Define categories of processed/prepared foods to avoid for basic ingredients
    processed_keywords = {
        'chips', 'crackers', 'cookies', 'candy', 'cake', 'pie', 'bread', 'pasta', 'noodles',
        'soup', 'sauce', 'dressing', 'marinade', 'seasoning', 'mix', 'powder', 'extract',
        'frozen', 'canned', 'jarred', 'pickled', 'smoked', 'dried', 'instant', 'prepared',
        'cooked', 'baked', 'fried', 'roasted', 'grilled', 'bar', 'drink', 'beverage',
        'cereal', 'granola', 'yogurt', 'ice', 'cream', 'snack', 'treat', 'dessert', 
        'muffin', 'donut', 'cookie', 'cracker', 'chip'
    }
    
    # Basic ingredient categories that should match raw/simple products
    basic_ingredients = {
        'salt', 'pepper', 'sugar', 'flour', 'oil', 'vinegar', 'water', 'milk', 'eggs',
        'onion', 'garlic', 'tomato', 'potato', 'carrot', 'celery', 'lemon', 'lime',
        'parsley', 'basil', 'oregano', 'thyme', 'rosemary', 'paprika', 'cumin', 'cinnamon',
        'vanilla', 'honey', 'butter', 'cheese', 'rice', 'chicken', 'beef', 'pork', 'fish', 
        'salmon', 'tuna', 'shrimp', 'beans', 'lentils', 'saffron', 'ginger'
    }
    
    product_scores = []
    
    for product in grocery_data:
        # Skip if product already used to prevent exact duplicates
        if product.get('id') in used_product_ids:
            continue
            
        product_name_lower = product['name'].lower()
        product_name_clean = re.sub(r'[^\w\s]', '', product_name_lower)
        product_words = set(product_name_clean.split())

        # Score 1: Jaccard similarity of word sets
        intersection = len(ingredient_words.intersection(product_words))
        union = len(ingredient_words.union(product_words))
        jaccard_score = intersection / union if union != 0 else 0

        # Score 2: How many ingredient words are in the product name?
        words_found = sum(1 for word in ingredient_words if word in product_words)
        coverage_score = words_found / len(ingredient_words) if ingredient_words else 0
        
        # Score 3: Penalty for extra words in the product name
        length_diff = len(product_words) - len(ingredient_words)
        penalty = 1 - (length_diff / len(product_words)) if len(product_words) > len(ingredient_words) else 1
        penalty_score = max(0, penalty)

        # Score 4: Bonus if the ingredient is the start of the product name
        prefix_bonus = 1.3 if product_name_lower.startswith(ingredient_clean) else 1.0
        
        # Score 5: ROBUST FILTERING - Prevent false matches for basic ingredients
        is_basic_ingredient = any(basic_word in ingredient_clean for basic_word in basic_ingredients)
        has_processed_words = any(proc_word in product_name_lower for proc_word in processed_keywords)
        
        # Heavy penalty for basic ingredients matching processed foods
        if is_basic_ingredient and has_processed_words:
            # Allow some exceptions (e.g., "salt" can match "sea salt" but not "salt chips")
            ingredient_exceptions = {
                'salt': ['sea salt', 'kosher salt', 'table salt', 'rock salt', 'himalayan salt', 'iodized salt'],
                'pepper': ['black pepper', 'white pepper', 'ground pepper', 'peppercorns', 'cracked pepper'],
                'sugar': ['white sugar', 'brown sugar', 'raw sugar', 'cane sugar', 'granulated sugar'],
                'oil': ['olive oil', 'vegetable oil', 'coconut oil', 'canola oil', 'sunflower oil'],
                'vinegar': ['white vinegar', 'apple cider vinegar', 'balsamic vinegar', 'rice vinegar'],
                'flour': ['all purpose flour', 'wheat flour', 'bread flour', 'cake flour', 'whole wheat flour']
            }
            
            is_valid_exception = False
            main_ingredient = list(ingredient_words)[0] if len(ingredient_words) == 1 else ingredient_clean
            
            if main_ingredient in ingredient_exceptions:
                for exception in ingredient_exceptions[main_ingredient]:
                    if exception in product_name_lower:
                        is_valid_exception = True
                        break
            
            if not is_valid_exception:
                continue  # Skip this product entirely

        # Score 6: Exact word match requirement for single-word ingredients
        if len(ingredient_words) == 1:
            main_word = list(ingredient_words)[0]
            # Must be an exact word match, not just a substring
            if main_word not in product_name_lower.split():
                continue
        
        # Score 7: Advanced filtering for multi-word ingredients
        if len(ingredient_words) > 1:
            # For multi-word ingredients, ensure at least 70% of words match
            word_match_ratio = words_found / len(ingredient_words)
            if word_match_ratio < 0.7:
                continue
                
        # Score 8: Prioritize simpler products over complex ones
        simplicity_bonus = 1.0
        if len(product_words) <= 3:  # Simple products get bonus
            simplicity_bonus = 1.3
        elif len(product_words) <= 5:  # Medium complexity
            simplicity_bonus = 1.1
        elif len(product_words) > 8:  # Very complex products get penalty
            simplicity_bonus = 0.6

        # Score 9: Brand consistency bonus
        brand_bonus = 1.0
        product_brand = product.get('brand', '').lower()
        if product_brand:
            # Bonus for well-known, trusted brands for basic ingredients
            trusted_brands = {
                'great value', 'marketside', 'equate', 'morton', 'domino', 'crisco',
                'heinz', 'hellmann', 'best foods', 'mccormick', 'king arthur',
                'land o lakes', 'philadelphia', 'kraft', 'hunts'
            }
            if any(brand in product_brand for brand in trusted_brands):
                brand_bonus = 1.15

        # Score 10: Prevent overly processed alternatives
        ultra_processed_penalty = 1.0
        ultra_processed_keywords = {
            'instant', 'microwaveable', 'ready to eat', 'pre-cooked', 'just add water',
            'artificial', 'imitation', 'substitute', 'replacement', 'alternative'
        }
        if any(keyword in product_name_lower for keyword in ultra_processed_keywords):
            # Only allow if the ingredient itself suggests processed food
            if not any(proc in ingredient_clean for proc in ['instant', 'ready', 'quick']):
                ultra_processed_penalty = 0.3  # Heavy penalty

        # Combine scores with enhanced weighting
        final_score = ((jaccard_score * 0.25) + (coverage_score * 0.55) + (penalty_score * 0.2)) * prefix_bonus * simplicity_bonus * brand_bonus * ultra_processed_penalty

        # Higher threshold for better quality matches with stricter filtering
        if final_score > 0.5:
            product_scores.append((product, final_score))
            
    product_scores.sort(key=lambda x: x[1], reverse=True)
    
    # Additional deduplication within this ingredient's results
    final_products = []
    seen_signatures = set()
    
    for product, score in product_scores:
        signature = create_product_signature(product)
        if signature not in seen_signatures:
            final_products.append(product)
            seen_signatures.add(signature)
            
            # Also check for similarity with already selected products
            is_too_similar = False
            for existing_product in final_products[:-1]:  # Don't compare with itself
                if are_products_similar(product, existing_product, similarity_threshold=0.8):
                    is_too_similar = True
                    break
            
            if is_too_similar:
                final_products.pop()  # Remove the similar product
                seen_signatures.remove(signature)
        
        if len(final_products) >= top_n:
            break
    
    return final_products

def create_product_signature(product):
    """Create a unique signature for a product to detect near-duplicates using multiple similarity metrics."""
    name = product.get('name', '').lower().strip()
    brand = product.get('brand', '').lower().strip()
    size = product.get('product_size', '').lower().strip()
    
    # Clean and normalize the product name
    # Remove punctuation and extra spaces
    name_clean = re.sub(r'[^\w\s]', ' ', name)
    name_clean = re.sub(r'\s+', ' ', name_clean).strip()
    
    # Remove common filler words that don't affect product identity
    filler_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}
    name_words = [word for word in name_clean.split() if word not in filler_words]
    
    # Sort words to handle different word orders (e.g., "Frozen Wide Noodles" vs "Wide Frozen Noodles")
    name_normalized = ' '.join(sorted(name_words))
    
    # Create a comprehensive signature
    # Method 1: Core product identity (most important)
    core_signature = f"{brand}|{name_normalized}"
    
    # Method 2: Add size if available for more precision
    if size and size not in ['', 'n/a', 'na', 'none']:
        # Normalize size format
        size_clean = re.sub(r'[^\w\s]', ' ', size)
        size_clean = re.sub(r'\s+', ' ', size_clean).strip()
        core_signature += f"|{size_clean}"
    
    # Method 3: Create word-based signature for fuzzy matching
    # Use the 3 most distinctive words from the product name
    distinctive_words = []
    common_words = {'frozen', 'fresh', 'organic', 'natural', 'premium', 'classic', 'original', 'traditional'}
    
    for word in name_words:
        if len(word) > 2 and word not in common_words:
            distinctive_words.append(word)
    
    # Take up to 3 most distinctive words, sorted alphabetically
    distinctive_words = sorted(distinctive_words)[:3]
    word_signature = '|'.join(distinctive_words)
    
    # Combine signatures for maximum robustness
    final_signature = f"{core_signature}#{word_signature}"
    
    return final_signature

def are_products_similar(product1, product2, similarity_threshold=0.85):
    """Check if two products are likely the same using advanced similarity metrics."""
    
    # Get product names and clean them
    name1 = re.sub(r'[^\w\s]', ' ', product1.get('name', '').lower())
    name2 = re.sub(r'[^\w\s]', ' ', product2.get('name', '').lower())
    name1 = re.sub(r'\s+', ' ', name1).strip()
    name2 = re.sub(r'\s+', ' ', name2).strip()
    
    # Exact name match
    if name1 == name2:
        return True
    
    # Brand and core name comparison
    brand1 = product1.get('brand', '').lower().strip()
    brand2 = product2.get('brand', '').lower().strip()
    
    if brand1 and brand2 and brand1 == brand2:
        # Same brand, check name similarity
        words1 = set(name1.split())
        words2 = set(name2.split())
        
        if words1 and words2:
            intersection = len(words1.intersection(words2))
            union = len(words1.union(words2))
            jaccard_similarity = intersection / union if union > 0 else 0
            
            if jaccard_similarity >= similarity_threshold:
                return True
    
    # Levenshtein distance for very similar names
    def levenshtein_distance(s1, s2):
        if len(s1) < len(s2):
            return levenshtein_distance(s2, s1)
        if len(s2) == 0:
            return len(s1)
        
        previous_row = list(range(len(s2) + 1))
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        
        return previous_row[-1]
    
    # Calculate string similarity
    max_len = max(len(name1), len(name2))
    if max_len > 0:
        distance = levenshtein_distance(name1, name2)
        string_similarity = 1 - (distance / max_len)
        
        if string_similarity >= similarity_threshold:
            return True
    
    return False

def extract_ingredients_from_text(text):
    """Extract ingredient list from AI response, handling various formats."""
    # If the AI is asking a question, return it as a single item.
    if '?' in text and len(text.split()) < 20:
        return [text.strip()]

    # Remove common introductory phrases that aren't ingredients
    text = re.sub(r'^\s*(?:Sure,?\s*)?(?:Here are the ingredients for|The ingredients for|Ingredients for|For|To make).*?(?::|are|include)', '', text, flags=re.IGNORECASE).strip()
    text = re.sub(r'^\s*(?:Sure,?\s*)?here are.*?:', '', text, flags=re.IGNORECASE).strip()
    text = re.sub(r'^\s*Sure,?\s*', '', text, flags=re.IGNORECASE).strip()  # Remove standalone "Sure"
    text = re.sub(r'^\*+\s*', '', text).strip()
    
    # Split by both commas and newlines
    lines = text.strip().split('\n')
    all_ingredients = []
    
    for line in lines:
        line = line.strip()
        # Skip empty lines, "Sure" responses, or introductory text
        if (not line or 
            re.match(r'^(?:sure|here are|the ingredients|for|to make)$', line, re.IGNORECASE) or
            re.match(r'^(?:here are|the ingredients|for|to make)', line, re.IGNORECASE)):
            continue
            
        # Split by comma and clean up each potential ingredient
        if ',' in line:
            ingredients = [ing.strip() for ing in line.split(',') if ing.strip()]
        else:
            # If no comma, treat the whole line as one ingredient
            ingredients = [line] if line else []
            
        all_ingredients.extend(ingredients)
    
    final_ingredients = []
    for ingredient in all_ingredients:
        # Remove any lingering list markers, numbers, or formatting
        cleaned_ingredient = re.sub(r'^[\d\.\-\*•\)\]]+\s*', '', ingredient).strip()
        cleaned_ingredient = re.sub(r'^[a-z]\)\s*', '', cleaned_ingredient).strip()  # Remove "a)" style
        
        # Handle "/" separators within ingredients (e.g., "tomato sauce/pizza sauce")
        if '/' in cleaned_ingredient:
            # Split by "/" and add each alternative as a separate ingredient
            alternatives = [alt.strip() for alt in cleaned_ingredient.split('/') if alt.strip()]
            final_ingredients.extend(alternatives)
        else:
            # Skip if it's too short, contains only punctuation, looks like intro text, or is just "Sure"
            if (cleaned_ingredient and len(cleaned_ingredient) > 2 and 
                not re.match(r'^[^\w]*$', cleaned_ingredient) and
                not re.match(r'^(?:sure|ingredients|for|here|the|are|include)$', cleaned_ingredient, re.IGNORECASE) and
                not re.match(r'^(?:ingredients|for|here|the|are|include)', cleaned_ingredient, re.IGNORECASE)):
                final_ingredients.append(cleaned_ingredient)
            
    return final_ingredients

def extract_dish_name_from_prompt(prompt):
    """Extracts the dish name from a user prompt if it's a recipe-related question."""
    prompt_lower = prompt.lower().strip()
    
    # If the prompt is just a dish name (1-4 words), use it directly
    words = prompt_lower.split()
    if len(words) <= 4 and not any(word in prompt_lower for word in ['how', 'what', 'recipe', 'ingredients', 'make', 'cook']):
        return prompt_lower.title()
    
    # Check for common recipe-related phrases
    if 'recipe' in prompt_lower or 'cook' in prompt_lower or 'make' in prompt_lower:
        # Look for a specific dish name, e.g., "pizza", "paella", "cake"
        dish_match = re.search(r'(?:what|which|how to|how to make|how to cook|what is|what are|how to prepare|how to prepare a|how to prepare a )([a-zA-Z\s]+)(?: recipe| dish| meal| food| dish| meal| food)?', prompt_lower)
        if dish_match:
            return dish_match.group(1).strip().title()
            
        # Look for a general dish name, e.g., "chicken", "beef", "fish"
        dish_match = re.search(r'(?:what|which|how to|how to make|how to cook|what is|what are|how to prepare|how to prepare a|how to prepare a )([a-zA-Z\s]+)(?: recipe| dish| meal| food| dish| meal| food)?', prompt_lower)
        if dish_match:
            return dish_match.group(1).strip().title()
            
        # Look for a specific dish name in a list, e.g., "pizza, chicken, salad"
        dish_match = re.search(r'(?:what|which|how to|how to make|how to cook|what is|what are|how to prepare|how to prepare a|how to prepare a )([a-zA-Z\s]+)(?: recipe| dish| meal| food| dish| meal| food)?', prompt_lower)
        if dish_match:
            return dish_match.group(1).strip().title()
            
        # Look for a specific dish name in a list, e.g., "pizza, chicken, salad"
        dish_match = re.search(r'(?:what|which|how to|how to make|how to cook|what is|what are|how to prepare|how to prepare a|how to prepare a )([a-zA-Z\s]+)(?: recipe| dish| meal| food| dish| meal| food)?', prompt_lower)
        if dish_match:
            return dish_match.group(1).strip().title()
            
        # Fallback if no specific dish name found, try to extract a general dish name
        dish_match = re.search(r'(?:what|which|how to|how to make|how to cook|what is|what are|how to prepare|how to prepare a|how to prepare a )([a-zA-Z\s]+)(?: recipe| dish| meal| food| dish| meal| food)?', prompt_lower)
        if dish_match:
            return dish_match.group(1).strip().title()
    
    # Fallback: if it's a short prompt (likely a dish name), use it
    if len(prompt_lower) <= 50 and not any(word in prompt_lower for word in ['how', 'what', 'recipe', 'ingredients', 'make', 'cook', 'weather', 'time', 'date']):
        return prompt_lower.title()
            
    return None

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        user_prompt = data.get('prompt', '')
        model_name = data.get('model', 'qwen2.5:7b')
        mode = data.get('mode', 'normal')
        scanned_ingredients = data.get('scanned_ingredients', [])

        if not user_prompt:
            return jsonify({'error': 'Prompt is required'}), 400
        
        print(f"Chat request - Mode: {mode}, Prompt: {user_prompt}")
        if scanned_ingredients:
            print(f"Scanned ingredients: {scanned_ingredients}")
        
        # Different system prompts based on mode
        if mode == 'recipe' and scanned_ingredients:
            # Recipe mode with scanned ingredients
            ingredients_list = ', '.join(scanned_ingredients)
            system_prompt = f"""You are a professional chef and recipe creator. The user has scanned these ingredients using their phone: {ingredients_list}

Your task is to create recipes using PRIMARILY the scanned ingredients they have. Always prioritize using their scanned ingredients as the main components.

Guidelines:
- Create complete, detailed recipes that prominently feature their scanned ingredients
- Include cooking instructions, prep time, and serving size
- You may suggest 1-2 common pantry items (salt, pepper, oil, etc.) if needed to complete the recipe
- If they ask for a specific dish, adapt it to use their scanned ingredients creatively
- Be encouraging and explain how their scanned ingredients work well together
- Format your response clearly with ingredients list and step-by-step instructions
always give a full recipe even though not all ingredients are used, just make sure to use the scanned ingredients as much as possible
Respond naturally and conversationally, but focus on practical, cookable recipes."""
        else:
            # Normal mode - strict ingredient list only
            system_prompt = """You are a cooking ingredient generator. Your ONLY task is to output a comma-separated list of ingredients for the requested dish.

CRITICAL RULES:
1. Output ONLY ingredients, nothing else
2. No introductory text, no explanations, no questions
3. No "Here are the ingredients:", no "You'll need:", no prefixes
4. No cooking instructions, no measurements, no descriptions
5. Format: ingredient1, ingredient2, ingredient3   no parentheses, just pure ingredients, output all the necessary ingredients, no more, no less
6. Use "/" instead of "or" when listing alternatives (e.g., "tomato sauce/pizza sauce", "basil/oregano")
7.  really try to figure it out because some dishes are traditional and you might know them, and if you can't, output: "Unknown dish"
NEVER EVER REPEAT THE SAME INGREDIENT MORE THAN ONCE IN THE RECIPE
8. If the request is not food-related, output: "Not a cooking request"

EXAMPLES:
Input: "pizza"
Output: Pizza dough, tomato sauce/pizza sauce, mozzarella cheese, olive oil, basil/oregano, garlic

Input: "chocolate chip cookies"  
Output: All-purpose flour, butter, brown sugar/white sugar, eggs, vanilla extract, baking soda, salt, chocolate chips

Input: "beef stir fry"
Output: Beef strips, soy sauce, garlic, ginger, bell peppers/onion, broccoli, vegetable oil, cornstarch, sesame oil

Input: "what's the weather"
Output: Not a cooking request

Remember: ONLY the ingredient list, nothing more. Use "/" for alternatives, not "or"."""

        # Make request to Ollama
        ollama_response = requests.post('http://localhost:11434/api/generate', json={
            'model': model_name,
            'prompt': f"{system_prompt}\n\nUser: {user_prompt}\n\nAssistant:",
            'stream': False
        })
        
        if ollama_response.status_code != 200:
            return jsonify({'error': 'Failed to get response from Ollama'}), 500
        
        response_data = ollama_response.json()
        ai_response = response_data.get('response', '').strip()
        
        # Extract dish name for shopping list (only in normal mode)
        dish_name = None
        if mode == 'normal':
            dish_name = extract_dish_name_from_prompt(user_prompt)
        
        return jsonify({
            'response': ai_response,
            'dish_name': dish_name,
            'mode': mode,
            'scanned_ingredients_used': scanned_ingredients if mode == 'recipe' else []
        })
        
    except requests.RequestException as e:
        print(f"Ollama request error: {str(e)}")
        return jsonify({'error': 'Failed to connect to Ollama. Make sure it\'s running.'}), 500
    except Exception as e:
        print(f"Chat error: {str(e)}")
        return jsonify({'error': f'Chat failed: {str(e)}'}), 500

@app.route('/api/shopping-list', methods=['POST'])
def generate_shopping_list():
    """Generate shopping list from ingredients"""
    data = request.json
    ingredients_text = data.get('ingredients', '')
    dish_name = data.get('dish_name', 'your dish')
    
    # If dish_name is null, empty, or "null", use a better fallback
    if not dish_name or dish_name == 'null' or dish_name == 'None':
        dish_name = 'your dish'
    
    if not ingredients_text:
        return jsonify({"error": "Ingredients text is required"}), 400
    
    ingredients = extract_ingredients_from_text(ingredients_text)
    
    # If the only "ingredient" is a question, return immediately
    if len(ingredients) == 1 and '?' in ingredients[0]:
        return jsonify({
            'dish_name': dish_name,
            'shopping_list': [],
            'unmatched_ingredients': [],
            'question': ingredients[0]
        })

    if not ingredients:
        return jsonify({"error": "No valid ingredients found in the text"}), 400
    
    shopping_list = []
    unmatched_ingredients = []
    used_product_ids = set()  # Track used products to prevent exact duplicates
    used_product_signatures = set()  # Track similar products to prevent near-duplicates
    
    for ingredient in ingredients:
        matching_products = find_matching_products(ingredient, used_product_ids)
        
        if matching_products:
            # Advanced duplicate filtering: remove similar products
            filtered_products = []
            for product in matching_products:
                # Create a product signature for similarity detection
                signature = create_product_signature(product)
                
                if signature not in used_product_signatures:
                    filtered_products.append(product)
                    used_product_signatures.add(signature)
                    if product.get('id'):
                        used_product_ids.add(product['id'])
                        
            if filtered_products:
                shopping_list.append({
                    'ingredient': ingredient,
                    'products': filtered_products[:3]
                })
            else:
                unmatched_ingredients.append(ingredient)
        else:
            unmatched_ingredients.append(ingredient)
    
    return jsonify({
        'dish_name': dish_name,
        'shopping_list': shopping_list,
        'unmatched_ingredients': unmatched_ingredients,
        'total_ingredients': len(ingredients),
        'matched_ingredients': len(shopping_list)
    })

def scrape_go_upc(upc_code):
    """Scrape go-upc.com for product information with improved error handling"""
    try:
        # Search URL using the UPC code
        url = f"https://go-upc.com/search?q={upc_code}"
        
        # Set headers to mimic a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        
        print(f"Requesting URL: {url}")
        
        # GET request to the URL with headers
        response = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        
        # Check if the request was successful
        if response.status_code == 200:
            # Parse the HTML content
            soup = BeautifulSoup(response.content, 'html.parser')
            
            print(f"Page title: {soup.title.text if soup.title else 'No title'}")
            
            # Try multiple selectors to find product name
            product_name = None
            
            # Method 1: Look for h1 with class 'product-name'
            product_element = soup.find('h1', class_='product-name')
            if product_element:
                product_name = product_element.text.strip()
                print(f"Found product name (method 1): {product_name}")
            
            # Method 2: Look for any h1 tag
            if not product_name:
                h1_tags = soup.find_all('h1')
                for h1 in h1_tags:
                    text = h1.text.strip()
                    if text and not text.lower().startswith('search') and len(text) > 3:
                        product_name = text
                        print(f"Found product name (method 2): {product_name}")
                        break
            
            # Method 3: Look for product details in various containers
            if not product_name:
                selectors = [
                    '.product-title',
                    '.product-info h1',
                    '.product-info h2',
                    '.product-details h1',
                    '.item-title',
                    '[data-product-name]'
                ]
                
                for selector in selectors:
                    element = soup.select_one(selector)
                    if element:
                        product_name = element.text.strip()
                        print(f"Found product name (method 3 - {selector}): {product_name}")
                        break
            
            # Method 4: Look in page title
            if not product_name and soup.title:
                title_text = soup.title.text.strip()
                # Clean up title (remove site name, etc.)
                if ' - ' in title_text:
                    title_parts = title_text.split(' - ')
                    for part in title_parts:
                        if 'go-upc' not in part.lower() and 'search' not in part.lower() and len(part.strip()) > 3:
                            product_name = part.strip()
                            print(f"Found product name (method 4): {product_name}")
                            break
                elif 'go-upc' not in title_text.lower() and len(title_text) > 3:
                    product_name = title_text
                    print(f"Found product name (method 4 - full title): {product_name}")
            
            # Method 5: Look for any text that might be a product name
            if not product_name:
                # Look for divs or spans that might contain product info
                potential_elements = soup.find_all(['div', 'span', 'p'], string=True)
                for element in potential_elements:
                    text = element.get_text().strip()
                    # Skip if it's too short, contains common website text, or looks like navigation
                    if (len(text) > 10 and 
                        not any(skip_word in text.lower() for skip_word in ['search', 'home', 'about', 'contact', 'privacy', 'terms', 'login', 'register', 'menu']) and
                        not text.isdigit() and
                        not text.startswith('http')):
                        product_name = text
                        print(f"Found product name (method 5): {product_name}")
                        break
            
            if product_name:
                # Clean up the product name
                product_name = product_name.replace('\n', ' ').replace('\t', ' ')
                product_name = ' '.join(product_name.split())  # Remove extra whitespace
                
                # Remove common prefixes/suffixes
                prefixes_to_remove = ['Product:', 'Item:', 'Name:']
                for prefix in prefixes_to_remove:
                    if product_name.startswith(prefix):
                        product_name = product_name[len(prefix):].strip()
                
                print(f"Final cleaned product name: {product_name}")
                return product_name
            else:
                print("No product name found in page")
                # Print some of the page content for debugging
                print(f"Page content preview: {soup.get_text()[:500]}...")
                return 'N/A'
        else:
            print(f"Request failed with status: {response.status_code}")
            print(f"Response content: {response.text[:500]}...")
            return 'N/A'
            
    except requests.RequestException as e:
        print(f"Request error: {str(e)}")
        return 'N/A'
    except Exception as e:
        print(f"Scraping error: {str(e)}")
        return 'N/A'

def scrape_upcitemdb(upc_code):
    """Alternative UPC lookup using upcitemdb.com API"""
    try:
        url = f"https://api.upcitemdb.com/prod/trial/lookup?upc={upc_code}"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
        }
        
        print(f"Trying UPCItemDB API: {url}")
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('code') == 'OK' and data.get('items'):
                item = data['items'][0]
                product_name = item.get('title') or item.get('brand', '') + ' ' + item.get('model', '')
                product_name = product_name.strip()
                
                if product_name:
                    print(f"Found product via UPCItemDB: {product_name}")
                    return product_name
        
        print("UPCItemDB lookup failed")
        return 'N/A'
        
    except Exception as e:
        print(f"UPCItemDB error: {str(e)}")
        return 'N/A'

@app.route('/api/barcode-lookup', methods=['POST'])
def barcode_lookup():
    try:
        data = request.get_json()
        upc_code = data.get('upc', '').strip()
        
        if not upc_code:
            return jsonify({'error': 'UPC code is required'}), 400
            
        print(f"=== Looking up UPC: {upc_code} ===")
        
        # Try primary source (go-upc.com)
        print("Trying primary lookup (go-upc.com)...")
        product_name = scrape_go_upc(upc_code)
        
        # If primary fails, try alternative source
        if not product_name or product_name == 'N/A':
            print("Primary lookup failed, trying alternative (UPCItemDB)...")
            product_name = scrape_upcitemdb(upc_code)
        
        # If both fail, try some common test barcodes
        if not product_name or product_name == 'N/A':
            print("Both lookups failed, checking test barcodes...")
            test_products = {
                '049000028911': 'Coca-Cola Classic 12 fl oz Can',
                '044000032296': 'Oreo Chocolate Sandwich Cookies',
                '028400064057': 'Pepsi Cola 12 fl oz Can',
                '012000161155': 'Planters Dry Roasted Peanuts',
                '041220576463': 'Heinz Tomato Ketchup',
                '018200001031': 'Campbell\'s Chicken Noodle Soup',
                '072250007019': 'Lay\'s Classic Potato Chips',
                '030000056110': 'Cheerios Cereal',
                '011110021304': 'Kraft Mac & Cheese Original'
            }
            
            if upc_code in test_products:
                product_name = test_products[upc_code]
                print(f"Using test product: {product_name}")
        
        if product_name and product_name != 'N/A':
            print(f"=== SUCCESS: Found product '{product_name}' for UPC {upc_code} ===")
            return jsonify({
                'success': True,
                'upc': upc_code,
                'product_name': product_name,
                'source': 'lookup_service'
            })
        else:
            print(f"=== FAILED: No product found for UPC {upc_code} ===")
            return jsonify({
                'success': False,
                'upc': upc_code,
                'error': 'Product not found in any database',
                'fallback_name': f'Unknown Product ({upc_code})'
            })
            
    except Exception as e:
        print(f"=== ERROR: Barcode lookup failed: {str(e)} ===")
        return jsonify({'error': f'Lookup failed: {str(e)}'}), 500

# Load grocery data when the app starts
load_grocery_data()

if __name__ == '__main__':
    load_grocery_data()
    app.run(port=5001, debug=True)
