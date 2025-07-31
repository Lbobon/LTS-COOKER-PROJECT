# 🍳 Cooker - AI-Powered Cooking Assistant

Cooker is a project i built, in collaboration with my teammates, during the LTS AI Summer Camp. After having leanrt broadly about different Ai technologies, focusing on LLMs, Agentic AI from IBM watsonx, LuxProvide environement to train models, and more, we decided to build a web application, in less than 48 hours that combines barcode scanning, AI-powered recipe generation, and intelligent shopping list creation. Built with Flask, Ollama, and modern web technologies.

---

## 🌟 Features

### 🔍 **Barcode Scanning**
- **Real-time camera scanning** using ZXing-js library
- **Web Worker support** for smooth UI performance
- **Multiple barcode formats** (UPC-A, EAN-13, Code128, QR codes)
- **Test mode** for development and demo purposes
- **Automatic product lookup** via web scraping and APIs

### 🤖 **AI-Powered Recipe Generation**
- **Ollama integration** with Qwen 2.5:7B model
- **Two modes**: Normal (ingredient list) and Recipe (full recipes)
- **Scanned ingredients integration** - AI creates recipes from your scanned products
- **Smart ingredient extraction** with "/" alternatives support
- **Context-aware responses** based on user input

### 🛒 **Intelligent Shopping List**
- **Walmart grocery database** (568,534+ products)
- **Advanced product matching** with Jaccard similarity, word coverage, and brand bonuses
- **Duplicate prevention** using product signatures and similarity detection
- **Real product data** including prices, availability, and promotions
- **3 top recommendations** per ingredient with relevance scoring

### 🎨 **Modern UI/UX**
- **Dark/Light mode toggle**
- **Responsive design** for mobile and desktop
- **Full-screen shopping list** with grid layout
- **Compact shopping cart** with running total
- **Smooth animations** and visual feedback
- **Real-time status updates**

### 📱 **Mobile-First Features**
- **Camera access** for barcode scanning
- **Touch-friendly interface**
- **Offline-capable** once assets are cached
- **Progressive Web App** features

---

## 📁 Project Structure

```
LTS-COOKER-PROJECT/
├── 📄 app.js                    # Frontend JavaScript (991 lines)
├── 📄 index.html                # Main HTML page
├── 📄 style.css                 # Styling (1107 lines)
├── 🐍 backend.py                # Flask API server (844 lines)
├── 📊 WMT_Grocery_202209.csv    # Walmart grocery database (171MB)
├── 📋 requirements.txt          # Python dependencies
├── 📦 package.json              # Node.js dependencies (optional)
├── 🖼️  mouse.png                # UI assets
├── 🖼️  cooker.png               # UI assets
├── 📊 products.csv              # Backup product data
├── 📈 pipeline_chart.md         # System architecture diagrams
├── 🎨 cooking_assistant_diagram.txt  # ASCII architecture diagram
└── 📖 README.md                 # This file
```

---

## 🛠️ Prerequisites

### **Required Software**
| Tool | Version | Purpose |
|------|---------|---------|
| **Python** | 3.8+ | Backend API server |
| **pip** | Latest | Package management |
| **Ollama** | Latest | Local AI model hosting |
| **Modern Browser** | Chrome/Edge/Firefox | WebAssembly & camera support |

### **System Requirements**
- **RAM**: 8GB+ (for Ollama model)
- **Storage**: 5GB+ free space
- **Camera**: For barcode scanning
- **Internet**: For initial setup and web scraping

---

## 🚀 Installation & Setup

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

#### **Alternative Models** (if needed)
```bash
# Smaller, faster model
ollama pull qwen2.5:3b

# Different model family
ollama pull llama3.2:3b
ollama pull gemma2:2b
```

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
- ✅ `products.csv` (2.1MB) - Backup product data
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

**Expected output:**
```
--- Attempting to load grocery data from: WMT_Grocery_202209.csv ---
--- Successfully loaded 568534 products from WMT_Grocery_202209.csv ---
 * Running on http://127.0.0.1:5001
 * Debug mode: on
```

### **2. Start Frontend Server**
```bash
# In new terminal, serve frontend
python -m http.server 8000
```

**Expected output:**
```
Serving HTTP on :: port 8000 (http://[::]:8000/) ...
```

### **3. Access Application**
- **Frontend**: http://localhost:8000
- **Backend API**: http://localhost:5001
- **Ollama**: http://localhost:11434

---

## 🎯 How to Use

### **Basic Workflow**
1. **Open** http://localhost:8000
2. **Allow camera access** when prompted
3. **Ask for ingredients**: Type "pizza" or "chocolate chip cookies"
4. **Generate shopping list**: Click "🛒 Generate Shopping List"
5. **Scan products**: Use camera to scan barcodes
6. **Get recipes**: Switch to dark mode for recipe generation

### **Barcode Scanning**
1. **Click "Scan"** button (dark mode only)
2. **Point camera** at product barcode
3. **Hold steady** until detection
4. **Product automatically added** to ingredients list
5. **Use "🧪 Test Scan"** for demo mode

### **AI Recipe Generation**
1. **Switch to dark mode** (toggle button)
2. **Scan ingredients** using camera
3. **Ask for recipe**: "Make me a recipe with these ingredients"
4. **AI generates** complete recipe with instructions

### **Shopping List Features**
- **View full list**: Click "View My Cart"
- **Add to general cart**: Click "+" on products
- **Remove items**: Click "×" on cart items
- **Clear all**: Use "Clear All" button

---

## 🔧 Configuration

### **Backend Configuration**
Edit `backend.py` for:
- **Port**: Change `app.run(port=5001)`
- **Model**: Change `model_name = 'qwen2.5:7b'`
- **Database**: Modify CSV file path

### **Frontend Configuration**
Edit `app.js` for:
- **API URLs**: Update fetch endpoints
- **Scan rate**: Modify `scanRate` (default: 200ms)
- **UI behavior**: Customize animations and feedback

### **Environment Variables**
Create `.env` file (optional):
```env
OLLAMA_API_URL=http://localhost:11434
FLASK_PORT=5001
DEBUG_MODE=True
```

---

## 🐛 Troubleshooting

### **Common Issues & Solutions**

#### **Backend Issues**
| Problem | Solution |
|---------|----------|
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` |
| `Port already in use` | Change port in `backend.py` or kill process |
| `CSV file not found` | Ensure `WMT_Grocery_202209.csv` is in project root |
| `Ollama connection failed` | Start Ollama: `ollama serve` |

#### **Frontend Issues**
| Problem | Solution |
|---------|----------|
| `Camera permission denied` | Allow camera access in browser settings |
| `CORS errors` | Ensure backend is running on port 5001 |
| `Barcode not detected` | Improve lighting, hold steady, try different barcode |
| `404 errors` | Check file paths, clear browser cache |

#### **Ollama Issues**
| Problem | Solution |
|---------|----------|
| `Model not found` | Run `ollama pull qwen2.5:7b` |
| `Out of memory` | Use smaller model: `ollama pull qwen2.5:3b` |
| `Connection refused` | Start Ollama service: `ollama serve` |

#### **Performance Issues**
| Problem | Solution |
|---------|----------|
| `Slow scanning` | Reduce scan rate in `app.js` |
| `High memory usage` | Use smaller Ollama model |
| `Slow product matching` | Reduce CSV data or optimize algorithm |

### **Debug Commands**
```bash
# Check Ollama status
ollama list
ollama show qwen2.5:7b

# Test backend API
curl -X POST http://localhost:5001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "pizza"}'

# Check Python packages
pip list | grep -E "(Flask|requests|beautifulsoup)"

# Monitor system resources
# Windows: Task Manager
# macOS/Linux: htop or top
```

---

## 🔗 Useful Links

### **Documentation**
- [Ollama Documentation](https://ollama.ai/docs)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [ZXing-js Library](https://github.com/zxing-js/library)
- [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)

### **Models & Data**
- [Ollama Models](https://ollama.ai/library)
- [Qwen Models](https://huggingface.co/Qwen)
- [Walmart Product Data](https://www.kaggle.com/datasets/anshtanwar/walmart-grocery-dataset)

### **Development Tools**
- [Python Virtual Environments](https://docs.python.org/3/tutorial/venv.html)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [Postman](https://www.postman.com/) - API testing

### **Browser Support**
- [WebAssembly Support](https://caniuse.com/wasm)
- [getUserMedia Support](https://caniuse.com/getusermedia)
- [Web Workers Support](https://caniuse.com/webworkers)

---

## 🏗️ Architecture

### **System Components**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Ollama        │
│   (Port 8000)   │◄──►│   (Port 5001)   │◄──►│   (Port 11434)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
   ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
   │   Camera    │       │   CSV DB    │       │   AI Model  │
   │   Scanner   │       │   Scraper   │       │   (Qwen)    │
   └─────────────┘       └─────────────┘       └─────────────┘
```

### **Data Flow**
1. **User Input** → Frontend JavaScript
2. **Camera Feed** → ZXing-js → Barcode Detection
3. **API Request** → Flask Backend → Product Matching
4. **AI Prompt** → Ollama → Recipe Generation
5. **Response** → Frontend → UI Update

---

## 🧪 Testing

### **Manual Testing Checklist**
- [ ] Backend starts without errors
- [ ] Frontend loads at http://localhost:8000
- [ ] Camera permission granted
- [ ] Barcode scanning works
- [ ] Test scan mode works
- [ ] Product lookup returns results
- [ ] Shopping list generation works
- [ ] AI recipe generation works
- [ ] Dark/light mode toggle works
- [ ] Shopping cart functionality works

### **API Endpoints Test**
```bash
# Test chat endpoint
curl -X POST http://localhost:5001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "pizza", "mode": "normal"}'

# Test barcode lookup
curl -X POST http://localhost:5001/api/barcode-lookup \
  -H "Content-Type: application/json" \
  -d '{"upc": "049000028911"}'

# Test shopping list
curl -X POST http://localhost:5001/api/shopping-list \
  -H "Content-Type: application/json" \
  -d '{"ingredients": "tomato, cheese, bread", "dish_name": "pizza"}'
```

---

## 📊 Performance Metrics

### **Current Performance**
- **Backend startup**: ~5-10 seconds (CSV loading)
- **Barcode detection**: ~200ms per frame
- **Product matching**: ~50ms per ingredient
- **AI response**: ~2-5 seconds (depends on model)
- **Memory usage**: ~500MB (backend) + ~2GB (Ollama)

### **Optimization Tips**
- Use smaller Ollama model for faster responses
- Reduce CSV data size for faster matching
- Optimize scan rate based on device performance
- Use Web Workers for heavy computations

---

## 🤝 Contributing

### **Development Setup**
1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Make changes and test thoroughly
4. Submit pull request with detailed description

### **Code Standards**
- Follow PEP 8 for Python code
- Use meaningful variable names
- Add comments for complex logic
- Test all new features

---

## 📄 License

This project is part of the **LTS AI Summer Camp** and is built for educational purposes.

---

## 🙏 Acknowledgments

- **Ollama Team** - Local AI model hosting
- **ZXing Project** - Barcode scanning library
- **Walmart** - Product dataset
- **Flask Community** - Web framework
- **LTS AI Summer Camp** - Project inspiration

---

## 📞 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the error logs in browser console
3. Verify all prerequisites are installed
4. Test with the provided curl commands

---

**Built with ❤️ during LTS AI Summer Camp - A comprehensive cooking assistant that brings AI to your kitchen! 🍳✨**
