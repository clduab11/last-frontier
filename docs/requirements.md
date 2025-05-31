## Functional Requirements

1. User Authentication
   - Users must be able to register with email and password
   - Users must be able to log in with credentials
   - Users must be able to reset forgotten passwords

2. LLM Interaction
   - Users must be able to input prompts to the LLM
   - The LLM must respond to user prompts
   - The LLM must be able to understand and respond to follow-up questions

3. Conversation History
   - The system must store conversation history for each user
   - Users must be able to view their conversation history

## Edge Cases

1. Invalid User Input
   - The system must handle invalid user input (e.g. empty prompts)
   - The system must provide feedback to the user for invalid input

2. LLM Errors
   - The system must handle LLM errors (e.g. invalid responses)
   - The system must provide feedback to the user for LLM errors

## Acceptance Criteria

1. User Authentication
   - The system must authenticate users correctly
   - The system must authorize users to access their conversation history

2. LLM Interaction
   - The LLM must respond to user prompts correctly
   - The LLM must understand and respond to follow-up questions correctly

3. Conversation History
   - The system must store conversation history correctly
   - Users must be able to view their conversation history correctly