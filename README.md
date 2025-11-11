# AGUL - Adaptive Generative UI Library

> **OpenAPI to React UI Generator** - Instantly convert any OpenAPI/Swagger specification into a fully functional React admin interface.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)

## 🎯 What is AGUL?

AGUL (Adaptive Generative UI Library) is an MVP proof-of-concept that automatically generates a complete CRUD admin interface from your OpenAPI 3.0 or Swagger 2.0 specification. No code generation, no build steps—just point it at your API spec and start using your admin UI.

### ✨ Key Features

- 🚀 **Instant UI Generation** - Load any OpenAPI spec and get a working UI immediately
- 📋 **Full CRUD Operations** - List, view, create, edit, and delete resources
- 🎨 **Beautiful UI** - Built with Ant Design components
- 📱 **Responsive** - Works on desktop and mobile
- 🔄 **Real-time** - Direct API calls with SWR for data fetching
- 🌐 **Both OpenAPI 3.0 & Swagger 2.0** - Automatic conversion support
- 📊 **Smart Table Generation** - Auto-generates tables from your data
- 📝 **Smart Form Generation** - Auto-generates forms from your schemas
- 🎯 **Type-safe** - Full TypeScript support

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/tuannx/Adaptive-Generative-UI-Library.git
cd Adaptive-Generative-UI-Library

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will start on `http://localhost:5173/` and automatically load the Petstore API example.

### Build for Production

```bash
npm run build
npm run preview
```

## 📖 Usage

### Using the Default Example

The app comes pre-configured with the Petstore API. Simply run `npm run dev` and explore:

1. Navigate through the sidebar menu to see different resources
2. Click on any resource to view the list
3. Use the actions buttons to View, Edit, or Delete items
4. Click "Create New" to add new items

### Using Your Own OpenAPI Spec

#### Option 1: Upload via UI

1. If no routes are found, you'll see an upload button
2. Click "Upload OpenAPI Spec"
3. Select your `openapi.json` or `swagger.json` file
4. The UI will regenerate instantly

#### Option 2: Replace the Default Spec

1. Place your OpenAPI JSON file in `public/examples/`
2. Update `src/App.tsx`:

```typescript
// Change this line:
const response = await fetch('/examples/petstore.json');

// To your file:
const response = await fetch('/examples/your-api.json');
```

#### Option 3: Load from URL

Modify the `loadDefaultSpec` function in `App.tsx`:

```typescript
const loadDefaultSpec = async () => {
  setLoading(true);
  setError(null);

  try {
    const response = await fetch('https://your-api.com/openapi.json');
    const spec = await response.json();
    await processSpec(spec);
  } catch (err: any) {
    setError(`Failed to load OpenAPI spec: ${err.message}`);
  } finally {
    setLoading(false);
  }
};
```

## 🏗️ Architecture

### Project Structure

```
agul-mvp/
├── src/
│   ├── core/
│   │   ├── types.ts           # TypeScript type definitions
│   │   ├── parser.ts          # OpenAPI parser (converts spec to normalized format)
│   │   └── generator.ts       # Route generator (creates React Router routes)
│   ├── components/
│   │   ├── ListView.tsx       # List view with table for GET /resource
│   │   ├── DetailView.tsx     # Detail view for GET /resource/:id
│   │   ├── FormView.tsx       # Form view for POST/PUT operations
│   │   └── AppLayout.tsx      # Main layout with navigation
│   ├── App.tsx                # Main application component
│   ├── App.css                # Global styles
│   └── main.tsx               # Application entry point
├── public/
│   └── examples/
│       └── petstore.json      # Example OpenAPI specification
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Ant Design** - UI component library
- **React Router v6** - Routing
- **Axios** - HTTP client
- **SWR** - Data fetching and caching
- **swagger-parser** - OpenAPI validation and parsing

### How It Works

1. **Parse** - The OpenAPI spec is parsed and normalized (supports both OpenAPI 3.0 and Swagger 2.0)
2. **Generate** - Routes are generated based on endpoints:
   - `GET /resource` → ListView
   - `GET /resource/{id}` → DetailView
   - `POST /resource` → Create Form
   - `PUT /resource/{id}` → Edit Form
   - `DELETE` operations are integrated into List and Detail views
3. **Render** - React components are dynamically rendered based on the generated routes
4. **Execute** - API calls are made directly from the browser to your backend

## 🎨 Features in Detail

### List View

- Displays resources in a table
- Auto-generates columns from data structure
- Pagination support
- Actions: View, Edit, Delete
- Create New button

### Detail View

- Displays single resource details
- Smart formatting for different data types
- Handles nested objects and arrays
- Actions: Edit, Delete
- Back navigation

### Form View (Create/Edit)

- Auto-generates form fields from OpenAPI schema
- Smart field types based on schema:
  - `string` → Input
  - `number/integer` → InputNumber
  - `boolean` → Switch
  - `enum` → Select
  - `array` → Multi-select or Tags
  - `date/date-time` → DatePicker
  - `email` → Email validation
  - `url` → URL validation
- Field validation based on `required` property
- Success/error notifications

### Navigation

- Auto-generated sidebar menu
- Grouped by OpenAPI tags
- Collapsible sidebar
- Active route highlighting

## 📝 Example APIs to Try

### Public APIs with OpenAPI Specs

1. **Petstore** (Default)
   ```
   https://petstore.swagger.io/v2/swagger.json
   ```

2. **JSONPlaceholder**
   ```
   https://jsonplaceholder.typicode.com/
   Note: This doesn't have an OpenAPI spec, but you can create one
   ```

3. **GitHub API**
   ```
   https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json
   ```

4. **Stripe API**
   ```
   https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json
   ```

## 🔧 Configuration

### Customizing the Base URL

By default, AGUL uses the `servers[0].url` from your OpenAPI spec. To override:

```typescript
// In App.tsx
const parsed = await parseOpenAPI(spec);
parsed.baseUrl = 'https://your-custom-api.com';
```

### Customizing the Theme

Edit `src/App.tsx`:

```typescript
<ConfigProvider
  theme={{
    token: {
      colorPrimary: '#1890ff', // Change primary color
      borderRadius: 2,          // Change border radius
      // ... other theme tokens
    },
  }}
>
```

### Adding Authentication

AGUL MVP doesn't include authentication. To add it:

1. Intercept Axios requests to add auth headers:

```typescript
// In App.tsx or a separate file
import axios from 'axios';

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## 🚧 Known Limitations (MVP)

This is an MVP focused on speed and functionality. The following features are not yet implemented:

- ❌ Authentication/Authorization
- ❌ Pagination (shows all items)
- ❌ Search/Filter
- ❌ Advanced validation
- ❌ File upload
- ❌ Complex nested object editing
- ❌ WebSocket support
- ❌ Batch operations
- ❌ Custom field renderers
- ❌ Relationship management

## 🛣️ Roadmap

### v0.2 - Polish
- [ ] Add pagination support
- [ ] Add search and filter
- [ ] Improve error messages
- [ ] Add loading skeletons

### v0.3 - Features
- [ ] Authentication support (OAuth, JWT)
- [ ] File upload support
- [ ] Relationship management
- [ ] Custom field renderers

### v1.0 - Production Ready
- [ ] Plugin system
- [ ] Theming system
- [ ] Code generation option
- [ ] Comprehensive documentation
- [ ] Test coverage

## 🤝 Contributing

Contributions are welcome! This is an MVP, so there's plenty of room for improvement.

### How to Contribute

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a pull request

### Development Guidelines

- Follow the existing code style
- Add TypeScript types for all new code
- Test with multiple OpenAPI specs
- Update documentation for new features

## 🐛 Troubleshooting

### Issue: OpenAPI spec fails to load

**Solution**: Check that:
- Your spec is valid JSON
- Your spec conforms to OpenAPI 3.0 or Swagger 2.0
- CORS is enabled on your API server
- The URL is accessible

### Issue: No routes generated

**Solution**: Ensure your OpenAPI spec has:
- At least one path defined in `paths`
- HTTP methods (GET, POST, PUT, DELETE) on paths
- Valid operation objects

### Issue: CORS errors when making API calls

**Solution**:
- Enable CORS on your backend server
- Add appropriate CORS headers:
  ```
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
  Access-Control-Allow-Headers: Content-Type, Authorization
  ```

### Issue: Form fields not generating correctly

**Solution**:
- Ensure your request body has a proper schema
- Check that `components/schemas` or `definitions` are defined
- Verify that `$ref` references are correct

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- [Ant Design](https://ant.design/) - Beautiful React components
- [Vite](https://vitejs.dev/) - Lightning fast build tool
- [SWR](https://swr.vercel.app/) - React Hooks for data fetching
- [swagger-parser](https://github.com/APIDevTools/swagger-parser) - OpenAPI parser

## 📧 Contact

For questions, issues, or suggestions:
- Open an issue on GitHub
- Email: tuannx@example.com
- Twitter: @tuannx

---

**Made with ❤️ by the AGUL Team**

*Remember: This is an MVP. Use it, break it, improve it!*
