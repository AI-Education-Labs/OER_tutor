import json
from langchain_core.messages import ToolMessage
from langchain_community.tools import tool
#from retrievertool import generate_retriever_tool
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langchain.tools.retriever import create_retriever_tool
import ast
import re


class BasicToolNode:
    """
    A node that processes and executes tool requests embedded in the last AI message.
    """

    def __init__(self, tools: list) -> None:
        # Create a dictionary of tools for easy access by their names.
        self.tools_by_name = {tool.name: tool for tool in tools}

    def __call__(self, inputs: dict):
        """
        Process tool calls from the last AI message and execute them.
        """
        if messages := inputs.get("messages", []):
            message = messages[-1]
        else:
            raise ValueError("No messages found in input.")

        outputs = []

        for tool_call in message.tool_calls:
            tool_result = self.tools_by_name[tool_call["name"]].invoke(
                tool_call["args"]
            )
            outputs.append(
                ToolMessage(
                    content=json.dumps(tool_result),
                    name=tool_call["name"],
                    tool_call_id=tool_call["id"],
                )
            )
        return {"messages": outputs}
    
# ==========================================================================================
# Easily modify this list of tools to add or remove tools from the single agent.
# We can also add new agents with their own tools, as long as we route them properly in the workflow.
# Look at the example below to see how a tool is defined.

# [TEST]
# def sum(x,y):
#     z = x+y 
#     print("wtf")
#     return z
# @tool
# def add(a: int, b: int) -> int:
#     """Use this tool to add two numbers."""
#     return sum(a,b)
# ==========================================================================================
@tool
def query_generator_tool(user_message: str) -> str:
    """
    Generates a query based on the user's message.
    This tool can be used to improve the queries for the retriever.
    """
    llm = ChatOpenAI(temperature=0.0, model="gpt-3.5-turbo")
    prompt = f"""
    You are a helpful assistant that turns a student's question into a focused search query to retrieve relevant textbook content.
    
    Question: {user_message}
    
    Only return the search query, do not explain it.
    """
    response = llm.invoke(prompt)
    return response.content.strip()

guided_learning_plan = """
Important: We are only covering Chapter 1
Focus: Chapter 1 - What is Physics?
Step 1: Introduction to Physics

- Objective: Understand the basic definition and scope of physics.
- Activities:
- Begin with an open-ended question: "What do you think physics is, and why do you think it's important?"
- Discuss the distinction between classical and modern physics.
- Explore how physics serves as a foundation for other sciences and its role in technology.

Step 2: The Scientific Method

- Objective: Grasp the importance of the scientific method in physics.
- Activities:
- Ask: "Why do you think having a systematic approach like the scientific method is crucial in scientific inquiry?"
- Discuss the steps of the scientific method and their significance.
- Use a simple experiment or observation to illustrate how the scientific method is applied.

Step 3: Language of Physics

- Objective: Learn about physical quantities and units.
- Activities:
- Pose a question: "How do you think scientists ensure that their findings are understood universally?"
- Introduce the concept of physical quantities and units.
- Discuss the importance of standard units in scientific communication.

Step 4: Interdisciplinary Nature of Physics

- Objective: Recognize the connections between physics and other fields.
- Activities:
- Ask: "Can you think of an example where physics might play a role in biology or chemistry?"
- Explore examples of interdisciplinary applications, such as medical imaging or environmental science.
- Discuss how physics principles are applied in everyday technology.

Step 5: Reflection and Application

- Objective: Reflect on the chapter's content and apply it to real-world scenarios.
- Activities:
- Encourage the student to share how they see physics in their daily life.
- Discuss a piece of technology or a natural phenomenon and explore the physics behind it.
- Ask reflective questions: "How has your understanding of physics changed after this chapter?"

Step 6: Review and Recap

- Objective: Reinforce the key concepts learned in the chapter.
- Activities:
- Summarize the main points of the chapter.
- Engage in a Q&A session to clarify any doubts.
- Encourage the student to set goals for the next chapter."""

@tool
def stay_on_topic_tool(overall_conversation: str) -> str:
    """
    Checks if the overall conversation is in line with the generated guided learning plan.
    Move the topic back on track if it is not.
    """
    llm = ChatOpenAI(temperature=0.0, model="gpt-4o-mini")
    prompt = f"""
    You are a helpful assistant that checks if the overall conversation is in line with the generated guided learning plan.

    Guided learning plan: {guided_learning_plan}
    
    Overall conversation: {overall_conversation}
    
    return with instructions to reach guided learning path.
    """
    response = llm.invoke(prompt)
    return response.content.strip()
    
def get_tools(retriever):
    """
    Returns a list of tools for the chatbot.
    """    
    #textbook_retriever = generate_retriever_tool()
    textbook_retriever_tool = create_retriever_tool(
        retriever,
        "retrieve_textbook_content",
        "Search and return information from the textbook.")
    
    tools = [stay_on_topic_tool, query_generator_tool, textbook_retriever_tool]#[textbook_retriever] 
    return tools