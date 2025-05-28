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
        DEBUG=os.environ.get('FLASK_DEBUG', 'True').lower() == 'true',  # Convert to boolean
        # Add these for better configuration
        MAX_CONTENT_LENGTH=16 * 1024 * 1024,  # 16MB max request size
        JSON_SORT_KEYS=False,  # Preserve JSON key order
        JSONIFY_PRETTYPRINT_REGULAR=True if os.environ.get('FLASK_ENV') == 'development' else False
    )
    
    # Parse ALLOWED_ORIGINS properly
    allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*")
    if allowed_origins != "*":
        allowed_origins = [origin.strip() for origin in allowed_origins.split(',')]
    
    # Enable CORS with appropriate configuration
    CORS(app, resources={
        r"/api/*": {
            "origins": allowed_origins,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
    
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
        model_path = os.path.join(app.instance_path, 'models')
        os.makedirs(model_path, exist_ok=True)
        logger.info(f"Model directory ensured at: {model_path}")
    except OSError as e:
        logger.error(f"Failed to create directories: {e}")
    
    # Register blueprints
    try:
        from app.api.routes import api
        app.register_blueprint(api, url_prefix='/api')
        logger.info("API blueprint registered successfully")
    except ImportError as e:
        logger.error(f"Failed to register API blueprint: {e}")
        raise
    
    # Simple route for health check
    @app.route('/health')
    def health():
        return {
            'status': 'healthy', 
            'service': 'recipe-genie-ai',
            'version': '1.0.0',
            'environment': app.config['ENV']
        }
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return {'error': 'Not found'}, 404
    
    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal server error: {error}")
        return {'error': 'Internal server error'}, 500
    
    logger.info(f"Application initialized in {app.config['ENV']} mode")
    
    return app
