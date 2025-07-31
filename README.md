# 🍳 Cooker - AI-Powered Cooking Assistant

Cooker is a project i built, in collaboration with my teammates, during the LTS AI Summer Camp. After having leanrnt broadly about different AI technologies, focusing on LLMs, Agentic AI from IBM Watsonx, LuxProvide environement to train models, and more, we decided to build a web application, in less than 48 hours that combines barcode scanning, AI-powered recipe generation, and intelligent shopping list creation. Built with Flask, Ollama, and modern web technologies.
I was responsible for the backend, the frontend, and the AI model, basically the codingpart of the porject while my teammates spent their time ressourcing for datasets, innovative ideas, designs using figma, and making sure this idea was feasible (useful)
Here is a canvalink to our project:https://www.canva.com/design/DAGucFNjHgA/pjmk5-spFrEed23tMUxOsA/edit?utm_content=DAGucFNjHgA&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton
Disclaimer:if wanting to use this project, you will need to have a local instance of Ollama running, and a Walmart grocery database, so make sure you download the dataset from this link and put it into the folder:https://www.kaggle.com/datasets/thedevastator/product-prices-and-sizes-from-walmart-grocery
---

##🌟 Features

### 🔍 **Barcode Scanning**
- **Real-time camera scanning**
- **Web Worker support** 
- **Multiple barcode formats** (UPC-A, EAN-13, Code128, QR codes)
- **Test mode** for development and demo purposes (if no product barcodes are available)
- **Automatic product lookup** via web scraping

### 🤖 **AI-Powered Recipe Generation**
- **Ollama integration** with Qwen 2.5:7B model
- **Two modes**: Normal (ingredient list) and Recipe (full recipes)
- **Scanned ingredients integration**
- **Smart ingredient extraction** 
- **Context-aware responses** based on user input

### 🛒 **Intelligent Shopping List**
- **Walmart grocery database** (568,534+ products)
- **Advanced product matching** with Jaccard similarity, word coverage, and brand bonuses
- **Duplicate prevention** using product signatures and similarity detection
- **Real product data** including prices, availability, and promotions
- **3 top recommendations** per ingredient with relevance scoring


---

## 🛠️ Prerequisites

### **Required Software**
| Tool | Version | Purpose |
|------|---------|---------|
| **Python** | 3.8+ | Backend API server |
| **pip** | Latest | Package management |
| **Ollama** | Latest | Local AI model hosting |
| **Modern Browser** | Chrome/Edge/Firefox | WebAssembly & camera support |  ( we used safari to avoid issues with API calls, so if using safari the project should setup properly )

### **System Requirements**
- **RAM**: 8GB+ (for Ollama model)
- **Storage**: 5GB+ free space
- **Camera**: For barcode scanning
- **Internet**: For initial setup and web scraping

---

## 🚀 We would love for people to try our project out,and provide us feedback, so here is how to setup the project:

### **1. Clone/Download Project**
```bash
# Option A: Clone repository
git clone <repository-url>
cd LTS-COOKER-PROJECT

# Option B: Download and extract ZIP
# Navigate to project folder
cd LTS-COOKER-PROJECT
```

### **2. Install Ollama & AI Model**

#### **Install Ollama**
```bash
# Windows (PowerShell)
winget install Ollama.Ollama
# OR download from: https://ollama.ai/download

# macOS
brew install ollama
# OR download from: https://ollama.ai/download

# Linux
curl -fsSL https://ollama.ai/install.sh | sh
```

#### **Pull Required Model**
```bash
# Start Ollama service
ollama serve

# In new terminal, pull the model
ollama pull qwen2.5:7b

# Verify installation
ollama list
```
If you want to use a different model, you can change the model name in the backend.py file, and then pull the model again. (however aftermultiple rounds of testing, Qwen model was the perfect balance between speed and accuracy)

### **3. Setup Python Environment**

#### **Create Virtual Environment**
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

#### **Install Dependencies**
```bash
pip install -r requirements.txt
```

**Required packages:**
- `Flask==3.0.0` - Web framework
- `Flask-CORS==4.0.0` - Cross-origin support
- `requests==2.31.0` - HTTP requests
- `beautifulsoup4==4.12.2` - Web scraping
- `pandas==2.1.4` - Data processing

### **4. Verify Data Files**
Ensure these files are present:
- ✅ `WMT_Grocery_202209.csv` (171MB) - Main product database
- ✅ `mouse.png` & `cooker.png` - UI assets

---

## 🏃‍♂️ Running the Application

### **1. Start Backend Server**
```bash
# Activate virtual environment (if not already active)
venv\Scripts\activate  # Windows
source venv/bin/activate  # macOS/Linux

# Start Flask server
python backend.py
```

### **2. Start Frontend Server**
```bash
# In new terminal, serve frontend
python -m http.server 8000
```

### **3. Access Application**
- **Frontend**: http://localhost:8000
- **Backend API**: http://localhost:5001
- **Ollama**: http://localhost:11434

---


### **Basic Workflow**
1. **Open** http://localhost:8000
2. **Ask for ingredients**: Type "pizza" or "chocolate chip cookies", or whatever dish name you have in mind
3. **Generate shopping list**: Click "🛒 Generate Shopping List"
4. **Get recipes**: wait for recipe generation to finish
5. **Get shopping list**: wait for shopping list generation to finish
6. **View shopping list**: click on the "View My Cart" button
7. **Add to general cart**: click on the "+" button on the products you want to add to your cart
8. **Remove items**: click on the "×" button on the cart items you want to remove
9. **Clear all**: click on the "Clear All" button

### **Barcode Scanning**
1. **Click "Scan"** button (we named this dark mode only because it's the only mode that has a camera, and the color scheme is dark)
2. **Point camera** at product barcode
3. **Hold steady** until detection
4. **Product automatically added** to ingredients list

### **AI Recipe Generation**
1. **Switch to dark mode** (toggle button)
2. **Scan ingredients** using camera
3. **Ask for recipe**: "Make me a recipe with these ingredients"
4. **AI generates** complete recipe with instructions

Thank you for trying out our project, and we hope you enjoy it! Were happy for any feedback, and we hope you find it useful! 






