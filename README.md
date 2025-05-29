# Recipe Genie 

A smart recipe discovery application that helps you find delicious recipes based on the ingredients you have at home. Powered by AI to provide personalized recipe recommendations tailored to your preferences.

---

##  Features

- **Ingredient-Based Search:** Enter the ingredients you have available and discover recipes you can make right now
- **AI-Powered Recommendations:** Get personalized recipe suggestions based on your cooking history and preferences
- **Recipe Cards:** View detailed recipe information including ingredients, cooking time, and step-by-step instructions
- **Favorites System:** Save your favorite recipes for quick access later
- **User Profiles:** Track your cooking preferences and dietary restrictions
- **Responsive Design:** Works seamlessly on desktop and mobile devices

---

##  Getting Started

### Prerequisites

- Docker and Docker Compose installed on your system
- Internet connection for recipe API access

### Installation & Setup

1. **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/recipe-genie.git
    cd recipe-genie
    ```
2. **Start the application using Docker**
    ```bash
    docker-compose up -d
    ```
3. **Access the application**

    Open your web browser and navigate to [http://localhost:3000](http://localhost:3000)

    The application will be ready to use!

---

##  How to Use

### 1. Getting Started

- Open the Recipe Genie application in your web browser
- Create an account or log in if you're a returning user

### 2. Finding Recipes

- On the homepage, you'll see an ingredient input interface
- Start typing the ingredients you have available at home
- Each ingredient will be added to a visual list
- Remove ingredients by clicking the 'X' next to them if needed

### 3. Discovering Recipes

- Once you've added your ingredients, click the **"Find Recipes"** button
- The AI will search for recipes that match your ingredients
- Personalized recommendations will appear based on your preferences

### 4. Exploring Results

- Browse through recipe cards showing:
  - Recipe images
  - Required ingredients
  - Estimated cooking time
  - Difficulty level
- Click on any recipe card to view detailed instructions

### 5. Managing Favorites

- Click the heart icon on recipe cards to save favorites
- Access your saved recipes from your profile
- Build your personal recipe collection over time

### 6. Personalization

- The more you use Recipe Genie, the better it gets at understanding your preferences
- Mark recipes you've tried and rate them
- Set dietary restrictions in your profile for better recommendations

---

##  Technical Stack

- **Frontend:** React.js with responsive design
- **Backend:** Node.js with Express
- **AI Service:** Python Flask with machine learning capabilities
- **Database:** MongoDB for user data and preferences
- **External APIs:** Spoonacular for recipe data
- **Deployment:** Docker containerization

---

##  Configuration

The application runs on the following ports:

| Service        | URL/Port                 |
| -------------- | ------------------------ |
| Frontend       | http://localhost:3000    |
| Backend API    | http://localhost:5000    |
| AI Service     | http://localhost:5001    |
| MongoDB        | localhost:27017          |

---

Happy Cooking! 

---
