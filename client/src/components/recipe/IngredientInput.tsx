import React, { useState, useRef, useEffect } from 'react';
import { HiPlus, HiX } from 'react-icons/hi';

interface IngredientInputProps {
  onIngredientsChange: (ingredients: string[]) => void;
  initialIngredients?: string[];
}

const IngredientInput: React.FC<IngredientInputProps> = ({ 
  onIngredientsChange, 
  initialIngredients = [] 
}) => {
  const [ingredients, setIngredients] = useState<string[]>(initialIngredients);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onIngredientsChange(ingredients);
  }, [ingredients, onIngredientsChange]);

  const handleAddIngredient = () => {
    if (inputValue.trim() !== '') {
      if (!ingredients.includes(inputValue.trim().toLowerCase())) {
        setIngredients([...ingredients, inputValue.trim().toLowerCase()]);
      }
      setInputValue('');
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddIngredient();
    }
  };

  const handleRemoveIngredient = (index: number) => {
    const newIngredients = [...ingredients];
    newIngredients.splice(index, 1);
    setIngredients(newIngredients);
  };

  const commonIngredients = [
    'chicken', 'beef', 'rice', 'pasta', 'tomatoes', 
    'onions', 'garlic', 'potatoes', 'eggs', 'cheese'
  ];

  const addCommonIngredient = (ingredient: string) => {
    if (!ingredients.includes(ingredient)) {
      setIngredients([...ingredients, ingredient]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 mb-2">
        {ingredients.map((ingredient, index) => (
          <span 
            key={index} 
            className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full flex items-center gap-1 text-sm"
          >
            {ingredient}
            <button 
              onClick={() => handleRemoveIngredient(index)}
              className="text-teal-600 hover:text-teal-800 focus:outline-none"
              aria-label={`Remove ${ingredient}`}
            >
              {HiX({ className: "w-4 h-4" })}
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-grow">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            placeholder="Add an ingredient (e.g., chicken, rice)"
            aria-label="Ingredient input"
          />
        </div>
        <button
          onClick={handleAddIngredient}
          className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-4 py-2 flex items-center gap-1 transition-colors"
          aria-label="Add ingredient"
        >
          {HiPlus({ className: "w-5 h-5" })}
          Add
        </button>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Common ingredients:</h3>
        <div className="flex flex-wrap gap-2">
          {commonIngredients.map((ingredient) => (
            <button
              key={ingredient}
              onClick={() => addCommonIngredient(ingredient)}
              disabled={ingredients.includes(ingredient)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                ingredients.includes(ingredient)
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-800 hover:bg-teal-100 hover:text-teal-800'
              }`}
            >
              {ingredient}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IngredientInput;