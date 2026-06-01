/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
                    <h3 style={{ margin: 0, marginBottom: '6px' }}>{project.name}</h3>
                    {project.description && <p style={{ margin: 0, marginBottom: '8px' }}>{project.description}</p>}
                    {project.address && (
                      <span className="project-address" style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}>
                        <MapPin size={14} /> {project.address}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeSection === 'market' && <MarketPrices />}
      
      {activeSection === 'budget' && <BudgetCalculator />}

      {activeSection === 'calendar' && <GlobalCalendar />}
    </div>
  );
}