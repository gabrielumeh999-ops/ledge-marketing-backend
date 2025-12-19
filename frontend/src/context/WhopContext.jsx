import React, { createContext, useContext } from 'react'

const WhopContext = createContext(null)

export const WhopProvider = ({ children, value }) => {
  return (
    <WhopContext.Provider value={value}>
      {children}
    </WhopContext.Provider>
  )
}

export const useWhop = () => {
  const context = useContext(WhopContext)
  if (!context) {
    throw new Error('useWhop must be used within a WhopProvider')
  }
  return context
}