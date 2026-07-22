# Life OS Specification

Version: v0.1  
Status: Living Document  
Last Updated: 2026-07-22


# 1. Product Vision

Life OS는 개인과 가족의 생활 데이터를 하나의 운영체계로 관리하는 Personal Operating System이다.

목표:




Capture

↓

Understand

↓

Command

↓

Memory

↓

Query

↓

Action



```



사용자의 생활 데이터를 기록하고 이해하며,

필요한 행동으로 연결하는 개인 운영 시스템을 지향한다.





---



# 2. Architecture Principles





## 2.1 Domain First



Life OS의 중심은 LLM이 아니라 Domain이다.



잘못된 구조:



```



User

↓

LLM

↓

Database



```



현재 방향:



```



User

↓

AI Boundary

↓

Command Proposal

↓

Domain

↓

Event Store



```





---



## 2.2 AI Boundary



### Decision



LLM은 해석 계층까지만 담당한다.



### Reason



LLM이 직접 상태 변경 책임을 가지면

모델 변경과 Domain 안정성이 결합된다.



### Consequence



- LLM Provider 교체 가능

- Domain 테스트 유지 가능

- Validation Layer 필요





LLM 역할:



```



Natural Language

↓

Structured Proposal



```



담당하지 않는 것:



- Database 직접 수정

- Domain State 변경

- Business Rule 실행





---



# 3. Current Implementation





## Completed



- Event Store

- Command Engine

- Projection

- Inventory Domain

- Inventory Write Path

- Inventory Query Path

- Natural Language Command

- Natural Language Query

- Parser Interface

- Rule Parser

- LLM Parser

- Gemini LLM Adapter

- CommandProposal Validation





## In Progress



- Inventory Capability Boundary

- HTTP → Capability Migration





---



# 4. Core Architecture





## 4.1 Event Architecture



Source of Truth:



```



Event Store



```



흐름:



```



Command

↓

Event

↓

Projection

↓

Read Model



```



Read Model은 Projection 결과이며,

Event Store로부터 재구성 가능하다.





---



## 4.2 Command / Query Separation





Write:



```



User Input

↓

Command

↓

Event

↓

State Update



```





Read:



```



Query

↓

Read Model

↓

Response



```





---



## 4.3 Parser / Resolver Separation





Parser 책임:



```



User Language Interpretation



````



예:



```json

{

  "rawName": "계란",

  "quantity": 1,

  "unit": "판"

}

````



Resolver 책임:



```

Domain Entity Resolution

```



예:



```

계란

↓

Product UUID

```



Parser는 Domain Entity를 알지 않는다.



---



# 5. Domain Ownership Rule



각 Domain은 자신의 상태 변경 책임을 가진다.



예:



Inventory:



Owns:



* InventoryPurchased Event

* InventoryConsumed Event

* Inventory State



Knowledge:



Owns:



* Document Events

* Knowledge State



원칙:



```

Domain 내부 변경 가능



Cross Domain 조회 가능



Cross Domain 직접 수정 금지

```



---



# 6. Data Ownership Model



각 Capability는 자신의 데이터를 소유한다.



예:



```

Inventory Capability



owns:

- Inventory Events

- Inventory State





Knowledge Capability



owns:

- Document Events

- Knowledge State

```



Domain 간 결합은 Event 또는 명시적 Interface를 통해 관리한다.



---



# 7. Capability Layer



## Definition



Capability는 Domain 기능을 외부에 제공하는 Application Boundary이다.



현재 목표 구조:



```

HTTP

↓

Inventory Capability

↓

Application Use Case

↓

Domain

```



Capability 책임:



한다:



* 기능 제공

* Use Case 조합



하지 않는다:



* AI 판단

* Domain Logic

* Database 직접 접근



---



# 8. Agent Model (Future)



현재 단계:



```

Capability

```



미래:



```

Capability

↓

Agent

```



Capability:



> 무엇을 할 수 있는가



Agent:



> 무엇을 판단하고 행동하는가



Agent는 Context + Reasoning + Action 책임이 필요해지는 시점에 도입한다.



---



# 9. Roadmap



```

Foundation



██████████ 90%





Inventory Domain



██████████ 100%





Natural Language Boundary



█████████░ 90%





Capability Layer



███░░░░░░░





Artifact System



░░░░░░░░░░





Multi Domain Runtime



░░░░░░░░░░





Agent



░░░░░░░░░░

```



---



# 10. Non Goals



현재 목표가 아닌 것:



* LLM이 Database를 직접 조작하는 구조

* 완전 자율 Agent

* 모든 Domain을 한 번에 지원

* Universal Schema 설계

* 초기부터 Multi Agent System 구축



---



# 11. Design Evolution Log



## 2026-07-22



### Decision



Agent Layer 도입 보류.



### Context



현재 Inventory는 Capability 단계이며,

판단 및 자율 행동 책임이 존재하지 않는다.



### Alternatives



* AssistantService 즉시 도입

* InventoryAgent 생성



### Result



Capability Boundary를 우선 구축한다.



Agent는 Context + Decision + Action 책임이 필요한 시점에 도입한다.



