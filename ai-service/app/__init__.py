import os
import logging
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_app(test_config=None):
    """
    Create and configure the Flask application
    
    Args:
        test_config: Test configuration to override default config
        
    Returns:
        Configured Flask application
    """
    # Create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    
    # Load environment variables
    load_dotenv()
    
    # Configure app
    app.config.from_mapping(
        SECRET_KEY=os.environ.get('SECRET_KEY', 'dev'),
        MODEL_PATH=os.path.join(app.instance_path, 'models'),
        ENV=os.environ.get('FLASK_ENV', 'development'),
        DEBUG=os.environ.get('FLASK_DEBUG', True)
    )
    
    # Enable CORS with appropriate configuration
    CORS(app, resources={r"/api/*": {"origins": os.environ.get("ALLOWED_ORIGINS", "*")}})
    
    if test_config is None:
        # Load the instance config, if it exists, when not testing
        app.config.from_pyfile('config.py', silent=True)
    else:
        # Load the test config if passed in
        app.config.from_mapping(test_config)
    
    # Ensure the instance folder exists
    try:
        os.makedirs(app.instance_path, exist_ok=True)
        
        # Create model directory if it doesn't exist
        os.makedirs(os.path.join(app.instance_path, 'models'), exist_ok=True)
    except OSError:
        pass
    
    # Register blueprints
    from app.api.routes import api
    app.register_blueprint(api, url_prefix='/api')
    
    # Simple route for health check
    @app.route('/health')
    def health():
        return {'status': 'healthy', 'service': 'recipe-genie-ai'}
    
    logger.info(f"Application initialized in {app.config['ENV']} mode")
    
    return app